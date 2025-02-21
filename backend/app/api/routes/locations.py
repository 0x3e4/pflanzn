from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()

@router.post("/")
def create_location(name: str, db: Session = Depends(get_db)):
    conn = db.connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO locations (name) VALUES (%s)", (name,))
        conn.commit()
    except mariadb.IntegrityError:
        raise HTTPException(status_code=400, detail="Location already exists.")
    finally:
        cursor.close()
    return {"message": "Location added successfully"}

@router.get("/")
def get_locations(db: Session = Depends(get_db)):
    conn = db.connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM locations")
    locations = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    cursor.close()
    return locations

@router.delete("/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)):
    conn = db.connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM locations WHERE id = %s", (location_id,))
    conn.commit()
    cursor.close()
    return {"message": "Location deleted successfully"}

@router.put("/{location_id}/water")
def water_location(location_id: int, db: Session = Depends(get_db)):
    conn = db.connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE plants SET last_watered = NOW() WHERE location_id = %s", (location_id,))
    conn.commit()
    cursor.close()
    return {"message": "All plants in the location have been watered"}

@router.get("/{location_id}/plants")
def get_plants_by_location(location_id: int, db: Session = Depends(get_db)):
    conn = db.connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, species, last_watered FROM plants WHERE location_id = %s", (location_id,))
    plants = [{"id": row[0], "name": row[1], "species": row[2], "last_watered": row[3]} for row in cursor.fetchall()]
    cursor.close()
    return plants