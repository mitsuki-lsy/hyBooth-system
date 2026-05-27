function obstacleShape(obstacle) {
  return obstacle?.shape === "circle" ? "circle" : "rect";
}

function obstacleAreaFromSize(widthM, depthM, shape = "rect") {
  const width = Math.max(0, Number(widthM || 0));
  const depth = Math.max(0, Number(depthM || 0));
  const area = shape === "circle" ? Math.PI * (width / 2) * (depth / 2) : width * depth;
  return Number(area.toFixed(3));
}

function obstacleAreaSqm(db, obstacle) {
  const scale = Math.max(1, Number(db.map?.scalePxPerMeter || 16));
  const area = Number(obstacle.area || 0);
  if (area > 0) return area;
  const widthM = obstacle.widthM !== undefined ? Number(obstacle.widthM || 0) : Number(obstacle.width || 0) / scale;
  const depthM = obstacle.depthM !== undefined ? Number(obstacle.depthM || 0) : Number(obstacle.height || 0) / scale;
  return obstacleAreaFromSize(widthM, depthM, obstacleShape(obstacle));
}

function boothObstacleArea(db, booth) {
  const total = (db.obstacles || [])
    .filter((obstacle) => obstacle.type === "internal" && Number(obstacle.boothId) === Number(booth.id))
    .reduce((sum, obstacle) => sum + obstacleAreaSqm(db, obstacle), 0);
  return Number(Math.min(Number(booth.area || 0), total).toFixed(3));
}

function boothBillableArea(db, booth) {
  return Number(Math.max(0, Number(booth.area || 0) - boothObstacleArea(db, booth)).toFixed(3));
}

function boothPrice(db, booth) {
  const billableArea = boothBillableArea(db, booth);
  if (booth.attr === "raw") {
    return Math.round(billableArea * Number(db.settings.rules.rawPrice || 0));
  }
  return Math.round(Number(db.settings.rules.standardPrice || 0) * (billableArea / 9));
}

function boothEquivalentCount(booths) {
  return Number((booths || []).reduce((sum, booth) => {
    return sum + Number(booth.area || 0) / 9;
  }, 0).toFixed(2));
}

module.exports = {
  obstacleShape,
  obstacleAreaFromSize,
  obstacleAreaSqm,
  boothObstacleArea,
  boothBillableArea,
  boothPrice,
  boothEquivalentCount
};
