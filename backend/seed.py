"""
seed.py — Wipes and re-seeds the database with 2 projects and 4 users.
Run once to get a clean starting state for demos.

Usage:
    python seed.py
"""

from database import engine, SessionLocal, Base
import models  # registers all ORM classes with Base

# ── 1. Recreate all tables ──────────────────────────────────────────────────
print("Dropping and recreating all tables...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("Tables created.\n")

db = SessionLocal()

try:
    # ── 2. Projects ─────────────────────────────────────────────────────────
    project_alpha = models.Project(name="Project Alpha — Mobile Redesign")
    project_beta  = models.Project(name="Project Beta  — API Gateway v2")
    db.add_all([project_alpha, project_beta])
    db.flush()  # get IDs before creating users

    # ── 3. Users ─────────────────────────────────────────────────────────────
    # Two employees per project + one manager per project
    users = [
        models.User(name="Alice Chen",    role=models.UserRole.employee, project_id=project_alpha.id),
        models.User(name="Bob Patel",     role=models.UserRole.employee, project_id=project_alpha.id),
        models.User(name="Carol Nguyen",  role=models.UserRole.employee, project_id=project_beta.id),
        models.User(name="David Kim",     role=models.UserRole.employee, project_id=project_beta.id),
        models.User(name="Eve Ramirez",   role=models.UserRole.manager,  project_id=project_alpha.id),
        models.User(name="Frank Hassan",  role=models.UserRole.manager,  project_id=project_beta.id),
    ]
    db.add_all(users)
    db.commit()

    print("Seeded successfully!\n")
    print("-- Projects ------------------------------------------")
    for p in db.query(models.Project).all():
        print(f"  [{p.id}] {p.name}")

    print("\n-- Users ---------------------------------------------")
    for u in db.query(models.User).all():
        print(f"  [{u.id}] {u.name:<20} role={u.role.value:<10} project_id={u.project_id}")

    print("\nDone. pulse.db is ready.")

except Exception as e:
    db.rollback()
    raise e
finally:
    db.close()
