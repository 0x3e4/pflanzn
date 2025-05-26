from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Text, Table, Index, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

plant_tag_association = Table(
    "plant_tag_association",
    Base.metadata,
    Column("plant_id", Integer, ForeignKey("plants.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=True)
    role = Column(String(50), default="user")
    auth_type = Column(String(10), default="local", nullable=False)

class Plant(Base):
    __tablename__ = "plants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    species = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False)
    archive_reason = Column(Text, nullable=True)

    tags = relationship("Tag", secondary=plant_tag_association, back_populates="plants")
    images = relationship("PlantImage", back_populates="plant", cascade="all, delete-orphan")
    waterings = relationship("PlantWatering", back_populates="plant", cascade="all, delete-orphan")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)

    plants = relationship("Plant", secondary=plant_tag_association, back_populates="tags")

class PlantWatering(Base):
    __tablename__ = "plant_waterings"
    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    watered_at = Column(DateTime, nullable=False)

    plant = relationship("Plant", back_populates="waterings")

    __table_args__ = (
        Index("idx_plant_waterings_plant_id", "plant_id"),
    )

class PlantImage(Base):
    __tablename__ = "plant_images"
    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    image_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime, default=func.now())
    plant = relationship("Plant", back_populates="images")

class PlantIdentification(Base):
    __tablename__ = "plant_identifications"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    image_path = Column(String(512), nullable=True)
    scientific_name = Column(String(255), nullable=False)
    common_name = Column(String(255), nullable=True)
    confidence_score = Column(String(10), nullable=True)
    result_images = Column(Text, nullable=True)
    identified_at = Column(DateTime, default=func.now())
    is_primary = Column(Boolean, default=False)

    user = relationship("User", backref="identifications")