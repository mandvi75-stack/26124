from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import csv
import io

from ..database import get_db
from ..models import Incident, RoadDefect, InfrastructureItem

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportRequest(BaseModel):
    type: str
    format: str = "csv"
    period: str = "7d"


def get_since(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "24h":
        return now - timedelta(hours=24)
    elif period == "7d":
        return now - timedelta(days=7)
    elif period == "30d":
        return now - timedelta(days=30)
    elif period == "90d":
        return now - timedelta(days=90)
    return now - timedelta(days=7)


@router.post("/generate")
async def generate_report(request: ReportRequest, db: AsyncSession = Depends(get_db)):
    since = get_since(request.period)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if request.type == "incidents":
        writer.writerow(["ID", "Type", "Severity", "Status", "Confidence", "Bus ID", "Location", "Number Plate", "Timestamp"])
        result = await db.execute(select(Incident).where(Incident.timestamp >= since).order_by(desc(Incident.timestamp)))
        for i in result.scalars():
            writer.writerow([i.id[:8], i.type, i.severity, i.status, f"{round(i.confidence*100)}%", i.bus_id, f"{i.lat:.4f},{i.lng:.4f}", i.number_plate or "", i.timestamp.strftime("%Y-%m-%d %H:%M") if i.timestamp else ""])
    
    elif request.type == "road_conditions":
        writer.writerow(["ID", "Type", "Severity", "Status", "Location", "Observations", "Confidence", "Priority", "First Seen"])
        result = await db.execute(select(RoadDefect).order_by(desc(RoadDefect.last_observed)))
        for d in result.scalars():
            writer.writerow([d.id[:8], d.type, d.severity, d.status, f"{d.lat:.4f},{d.lng:.4f}", d.observation_count, f"{round(d.confidence*100)}%", d.maintenance_priority, d.first_observed.strftime("%Y-%m-%d") if d.first_observed else ""])
    
    elif request.type == "infrastructure":
        writer.writerow(["ID", "Type", "Severity", "Status", "Location", "First Detected", "Last Verified"])
        result = await db.execute(select(InfrastructureItem).order_by(desc(InfrastructureItem.first_detected)))
        for i in result.scalars():
            writer.writerow([i.id[:8], i.type, i.severity, i.status, f"{i.lat:.4f},{i.lng:.4f}", i.first_detected.strftime("%Y-%m-%d") if i.first_detected else "", i.last_verified.strftime("%Y-%m-%d") if i.last_verified else ""])
    
    else:
        writer.writerow(["Report Type", "Generated At", "Period"])
        writer.writerow([request.type, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), request.period])
    
    output.seek(0)
    filename = f"prahari-{request.type}-{datetime.now().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
