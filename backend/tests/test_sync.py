from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings
from tests.conftest import make_preset, make_workout, new_id


def sync(client, headers, **body):
    response = client.post("/sync", json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_empty_sync_returns_a_cursor_and_nothing_else(client, alice):
    data = sync(client, alice)
    assert data["workouts"] == [] and data["presets"] == []
    assert data["deleted_workouts"] == [] and data["deleted_presets"] == []
    assert data["settings"] is None
    assert data["cursor"]


def test_pushed_workout_round_trips_with_all_its_nested_data(client, alice):
    workout = make_workout()
    sync(client, alice, workouts=[workout])
    pulled = sync(client, alice)["workouts"]  # a fresh device: no cursor, full pull
    assert len(pulled) == 1
    got = pulled[0]
    assert got["id"] == workout["id"]
    assert got["name"] == "Push Day" and got["status"] == "active"
    assert got["rest"] == {"ends_at": 1_790_000_000_000, "total": 90}
    assert got["exercises"][0]["plan"] == {"sets": 4, "reps": 8, "weight": 135.0}
    assert got["exercises"][0]["sets"][0]["id"] == workout["exercises"][0]["sets"][0]["id"]
    assert got["exercises"][0]["sets"][0]["weight"] == 135.0


def test_exercise_and_set_order_is_preserved(client, alice):
    workout = make_workout()
    names = ["Bench", "Row", "Dips"]
    workout["exercises"] = [{"id": new_id(), "name": n, "plan": None, "sets": []} for n in names]
    sync(client, alice, workouts=[workout])
    got = sync(client, alice)["workouts"][0]
    assert [e["name"] for e in got["exercises"]] == names
    assert all(e["plan"] is None for e in got["exercises"])


def test_pulling_with_a_cursor_returns_only_newer_changes(client, alice):
    first = make_workout()
    cursor = sync(client, alice, workouts=[first])["cursor"]
    assert sync(client, alice, cursor=cursor)["workouts"] == []

    second = make_workout(name="Pull Day")
    result = sync(client, alice, cursor=cursor, workouts=[second])
    assert [w["id"] for w in result["workouts"]] == [second["id"]]


def test_pushing_the_same_payload_twice_is_harmless(client, alice):
    workout = make_workout()
    sync(client, alice, workouts=[workout])
    sync(client, alice, workouts=[workout])
    assert len(client.get("/workouts", headers=alice).json()) == 1


def test_a_newer_edit_replaces_the_workout_including_its_children(client, alice):
    workout = make_workout(updated_at=1000)
    sync(client, alice, workouts=[workout])

    edited = {**workout, "updated_at": 2000, "name": "Heavy Push", "exercises": []}
    sync(client, alice, workouts=[edited])

    got = client.get("/workouts", headers=alice).json()[0]
    assert got["name"] == "Heavy Push"
    assert got["exercises"] == []


def test_reusing_the_same_child_ids_on_update_does_not_conflict(client, alice):
    workout = make_workout(updated_at=1000)
    sync(client, alice, workouts=[workout])

    workout["updated_at"] = 2000
    workout["exercises"][0]["sets"][0]["reps"] = 12
    sync(client, alice, workouts=[workout])

    got = client.get("/workouts", headers=alice).json()[0]
    assert got["exercises"][0]["sets"][0]["reps"] == 12
    assert len(got["exercises"]) == 1 and len(got["exercises"][0]["sets"]) == 1


def test_an_older_edit_loses_and_the_stale_device_receives_the_newer_copy(client, alice):
    original = make_workout(updated_at=1000, name="Original")
    stale_cursor = sync(client, alice, workouts=[original])["cursor"]  # device B syncs here, then goes offline

    newer = {**original, "updated_at": 5000, "name": "Newer"}          # device A edits meanwhile
    up_to_date_cursor = sync(client, alice, workouts=[newer])["cursor"]

    older_edit = {**original, "updated_at": 2000, "name": "Older edit"}  # device B comes back with its own edit
    reply = sync(client, alice, cursor=stale_cursor, workouts=[older_edit])

    assert client.get("/workouts", headers=alice).json()[0]["name"] == "Newer"  # B's older edit lost
    assert [w["name"] for w in reply["workouts"]] == ["Newer"]                  # and B is told the winner
    # A device that is already current has nothing to receive.
    assert sync(client, alice, cursor=reply["cursor"])["workouts"] == []
    assert up_to_date_cursor


def test_deleting_a_workout_leaves_a_tombstone_other_devices_can_pull(client, alice):
    workout = make_workout(updated_at=1000)
    cursor = sync(client, alice, workouts=[workout])["cursor"]

    reply = sync(client, alice, cursor=cursor, deleted_workouts=[{"id": workout["id"], "updated_at": 2000}])
    assert reply["deleted_workouts"] == [{"id": workout["id"], "updated_at": 2000}]
    assert client.get("/workouts", headers=alice).json() == []

    fresh_device = sync(client, alice)
    assert fresh_device["workouts"] == []
    assert fresh_device["deleted_workouts"][0]["id"] == workout["id"]


def test_a_delete_older_than_the_servers_copy_is_ignored(client, alice):
    workout = make_workout(updated_at=5000)
    sync(client, alice, workouts=[workout])
    sync(client, alice, deleted_workouts=[{"id": workout["id"], "updated_at": 1000}])
    assert len(client.get("/workouts", headers=alice).json()) == 1


def test_a_delete_for_something_the_server_never_saw_is_still_recorded(client, alice):
    unseen = new_id()
    reply = sync(client, alice, deleted_workouts=[{"id": unseen, "updated_at": 500}])
    assert reply["deleted_workouts"] == [{"id": unseen, "updated_at": 500}]
    assert client.get("/workouts", headers=alice).json() == []

    # A copy edited before that delete must not bring it back; one edited after it may.
    sync(client, alice, workouts=[make_workout(id=unseen, updated_at=100)])
    assert client.get("/workouts", headers=alice).json() == []
    sync(client, alice, workouts=[make_workout(id=unseen, updated_at=900)])
    assert len(client.get("/workouts", headers=alice).json()) == 1


def test_a_deleted_preset_the_server_never_saw_reaches_other_devices(client, alice):
    starter = new_id()
    sync(client, alice, deleted_presets=[{"id": starter, "updated_at": 500}])
    assert sync(client, alice)["deleted_presets"] == [{"id": starter, "updated_at": 500}]


def test_a_workout_can_be_recreated_after_deletion_with_a_newer_edit(client, alice):
    workout = make_workout(updated_at=1000)
    sync(client, alice, workouts=[workout])
    sync(client, alice, deleted_workouts=[{"id": workout["id"], "updated_at": 2000}])
    sync(client, alice, workouts=[{**workout, "updated_at": 3000}])
    assert len(client.get("/workouts", headers=alice).json()) == 1


def test_users_cannot_see_or_overwrite_each_others_data(client, alice, bob):
    shared_id = new_id()
    sync(client, alice, workouts=[make_workout(id=shared_id, name="Alice's")])
    # Bob picks the very same client id; it must land in his own account, not touch Alice's.
    sync(client, bob, workouts=[make_workout(id=shared_id, name="Bob's", updated_at=9999)])

    assert [w["name"] for w in client.get("/workouts", headers=alice).json()] == ["Alice's"]
    assert [w["name"] for w in client.get("/workouts", headers=bob).json()] == ["Bob's"]
    assert [w["name"] for w in sync(client, alice)["workouts"]] == ["Alice's"]


def test_users_cannot_delete_each_others_data(client, alice, bob):
    workout = make_workout()
    sync(client, alice, workouts=[workout])
    sync(client, bob, deleted_workouts=[{"id": workout["id"], "updated_at": 99999}])
    assert len(client.get("/workouts", headers=alice).json()) == 1


def test_presets_round_trip_and_delete(client, alice):
    preset = make_preset()
    sync(client, alice, presets=[preset])
    got = client.get("/presets", headers=alice).json()
    assert got[0]["name"] == "Leg Day"
    assert got[0]["exercises"] == [{"name": "Squat", "sets": 4, "reps": 8, "weight": 155.0}]

    sync(client, alice, presets=[{**preset, "updated_at": 2000, "exercises": []}])
    assert client.get("/presets", headers=alice).json()[0]["exercises"] == []

    reply = sync(client, alice, deleted_presets=[{"id": preset["id"], "updated_at": 3000}])
    assert reply["deleted_presets"][0]["id"] == preset["id"]
    assert client.get("/presets", headers=alice).json() == []


def test_settings_use_last_write_wins(client, alice, bob):
    sync(client, alice, settings={"rest_timer_seconds": 120, "updated_at": 2000})
    reply = sync(client, alice, settings={"rest_timer_seconds": 45, "updated_at": 1000})
    assert reply["settings"] == {"rest_timer_seconds": 120, "updated_at": 2000}

    reply = sync(client, alice, settings={"rest_timer_seconds": 60, "updated_at": 3000})
    assert reply["settings"]["rest_timer_seconds"] == 60
    assert client.get("/auth/me", headers=alice).json()["rest_timer_seconds"] == 60

    assert sync(client, bob)["settings"] is None


def test_invalid_payloads_are_rejected(client, alice):
    cases = [
        {"workouts": [make_workout(status="paused")]},
        {"workouts": [make_workout(date="not-a-date")]},
        {"workouts": [{**make_workout(), "id": "not-a-uuid"}]},
        {"settings": {"rest_timer_seconds": 5, "updated_at": 1}},
        {"presets": [make_preset(name="")]},
        {"workouts": [make_workout() for _ in range(201)]},
    ]
    for body in cases:
        assert client.post("/sync", json=body, headers=alice).status_code == 422, list(body)


def test_a_failed_push_changes_nothing(client, alice):
    good = make_workout(name="Good")
    bad = make_workout(status="paused")
    assert client.post("/sync", json={"workouts": [good, bad]}, headers=alice).status_code == 422
    assert client.get("/workouts", headers=alice).json() == []


def test_token_is_refreshed_only_when_it_is_getting_old(client, alice):
    assert sync(client, alice)["token"] is None

    old = datetime.now(timezone.utc) - timedelta(minutes=30)
    token = jwt.encode(
        {"sub": "1", "iat": int(old.timestamp()), "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    reply = sync(client, {"Authorization": f"Bearer {token}"})
    assert reply["token"]
    refreshed = {"Authorization": f"Bearer {reply['token']}"}
    assert client.get("/auth/me", headers=refreshed).status_code == 200


def test_exercise_history_spans_workouts_and_ignores_other_users_and_deleted_workouts(client, alice, bob):
    def bench(weight, when):
        w = make_workout()
        w["exercises"][0]["name"] = "bench press"
        w["exercises"][0]["sets"][0].update(weight=weight, completed_at=when)
        return w

    kept = [bench(100, "2026-09-01T10:00:00Z"), bench(110, "2026-09-08T10:00:00Z")]
    doomed = bench(999, "2026-09-09T10:00:00Z")
    sync(client, alice, workouts=[*kept, doomed])
    sync(client, alice, deleted_workouts=[{"id": doomed["id"], "updated_at": 5000}])
    sync(client, bob, workouts=[bench(500, "2026-09-02T10:00:00Z")])

    history = client.get("/exercises/history", params={"name": "Bench Press"}, headers=alice).json()
    assert [s["weight"] for s in history] == [100.0, 110.0]
    assert client.get("/exercises/history", params={"name": "Squat"}, headers=alice).json() == []


def test_two_devices_converge(client, alice):
    """Device A and device B each make offline changes, then both sync; they end up identical."""
    a_workout = make_workout(name="From phone")
    b_workout = make_workout(name="From laptop")
    a_cursor = sync(client, alice, workouts=[a_workout])["cursor"]
    b_first = sync(client, alice, workouts=[b_workout])          # laptop's first sync sees the phone's data too
    assert {w["name"] for w in b_first["workouts"]} == {"From phone", "From laptop"}

    a_second = sync(client, alice, cursor=a_cursor)              # the phone now picks up the laptop's workout
    assert {w["name"] for w in a_second["workouts"]} >= {"From laptop"}
