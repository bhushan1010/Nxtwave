"""
seed.py — Seeds the database with 2 projects and 6 users.
Idempotent: only seeds if the projects table is empty.

Usage:
    python seed.py            # Seeds only if empty (safe)
    python seed.py --reset    # Wipes all tables and re-seeds
"""

import sys
from database import engine, SessionLocal, Base
import models  # registers all ORM classes with Base


def seed(drop=False):
    if drop:
        print("Dropping and recreating all tables...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Idempotent check: only seed if the database is empty
        existing_count = db.query(models.Project).count()
        if existing_count > 0 and not drop:
            print(f"Database already contains {existing_count} projects; skipping seed.")
            return

        print("Seeding initial projects and users...")

        # ── Projects ─────────────────────────────────────────────────────────────
        project_alpha = models.Project(name="Project Alpha — Mobile Redesign")
        project_beta  = models.Project(name="Project Beta  — API Gateway v2")
        db.add_all([project_alpha, project_beta])
        db.flush()  # get IDs before creating users

        # ── Users ─────────────────────────────────────────────────────────────────
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

        print("\nDatabase is ready.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    force_reset = "--reset" in sys.argv
    seed(drop=force_reset)
