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

    waterings_created = relationship("PlantWatering", back_populates="created_by")
    images_uploaded = relationship("PlantImage", back_populates="uploaded_by")
    care_advice_created = relationship("PlantCareAdvice", back_populates="created_by")
    notes_created = relationship("PlantNote", back_populates="created_by")

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
    care_advice = relationship("PlantCareAdvice", back_populates="plant", cascade="all, delete-orphan")
    notes = relationship("PlantNote", back_populates="plant", cascade="all, delete-orphan")

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

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    plant = relationship("Plant", back_populates="waterings")
    created_by = relationship("User", back_populates="waterings_created")

    __table_args__ = (
        Index("idx_plant_waterings_plant_id", "plant_id"),
    )

class PlantImage(Base):
    __tablename__ = "plant_images"
    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    image_path = Column(String(512), nullable=False)
    uploaded_at = Column(DateTime, default=func.now())

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    plant = relationship("Plant", back_populates="images")
    uploaded_by = relationship("User", back_populates="images_uploaded")

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

class PlantCareAdvice(Base):
    __tablename__ = "plant_care_advice"
    
    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    advice_text = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=func.now())
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    plant = relationship("Plant", back_populates="care_advice")
    created_by = relationship("User", back_populates="care_advice_created")
    
    __table_args__ = (
        Index("idx_plant_care_advice_plant_id", "plant_id"),
        Index("idx_plant_care_advice_generated_at", "generated_at"),
    )

class PlantNote(Base):
    __tablename__ = "plant_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    note_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    plant = relationship("Plant", back_populates="notes")
    created_by = relationship("User", back_populates="notes_created")
    
    __table_args__ = (
        Index("idx_plant_notes_plant_id", "plant_id"),
        Index("idx_plant_notes_created_at", "created_at"),
    )