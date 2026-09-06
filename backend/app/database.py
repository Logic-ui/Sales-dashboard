from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()

def repair_legacy_sale_owners():
	with engine.begin() as connection:
		connection.execute(text(
			"""
			UPDATE sales
			SET user_id = (
				SELECT users.id FROM users WHERE users.email = sales.user_id
			)
			WHERE typeof(user_id) = 'text'
			"""
		))
		connection.execute(text(
			"UPDATE sales SET user_id = NULL WHERE typeof(user_id) = 'text'"
		))
