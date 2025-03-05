from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="user")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    plants = relationship("Plant", back_populates="location")

class Plant(Base):
    __tablename__ = "plants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    species = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    last_watered = Column(DateTime, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    location = relationship("Location", back_populates="plants")
    images = relationship("PlantImage", back_populates="plant", cascade="all, delete-orphan")

class PlantImage(Base):
    __tablename__ = "plant_images"
    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    image_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime, default=func.now())
    plant = relationship("Plant", back_populates="images")