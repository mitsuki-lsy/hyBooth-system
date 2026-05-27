function approvedPaymentAmount(payments, orderId) {
  return (payments || [])
    .filter((payment) => payment.orderId === orderId && payment.status === "approved")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function hasPendingPayment(payments, orderId) {
  return (payments || []).some((payment) => payment.orderId === orderId && payment.status === "pending");
}

function depositRequired(settings, order) {
  return Math.ceil(Number(order.totalAmount || 0) * Number(settings.rules.depositRate || 0));
}

function markOrderBoothsSold(booths, order) {
  if (order.type !== "booth") return;
  (order.boothIds || []).forEach((boothId) => {
    const booth = booths.find((item) => item.id === boothId);
    if (booth) booth.status = "sold";
  });
}

function recalculateOrderStatus(db, order, isActiveOrder) {
  const approved = approvedPaymentAmount(db.payments, order.id);
  order.paidApprovedAmount = approved;
  order.depositRequired = depositRequired(db.settings, order);
  if (!isActiveOrder(order)) return order;

  if (order.specialApproved) {
    order.status = "sold";
    markOrderBoothsSold(db.booths, order);
    return order;
  }

  if (approved >= order.depositRequired && order.totalAmount > 0) {
    order.status = "sold";
    markOrderBoothsSold(db.booths, order);
  } else if (hasPendingPayment(db.payments, order.id)) {
    order.status = "pending_payment_review";
  } else {
    order.status = "reserved";
  }
  return order;
}

module.exports = {
  approvedPaymentAmount,
  hasPendingPayment,
  depositRequired,
  recalculateOrderStatus
};
