// Reusable business utilities will be placed here
// e.g., fee calculations, academic year parsers

export const calculateRemainingFee = (totalAmount, paidAmount, concessionAmount = 0) => {
  return totalAmount - paidAmount - concessionAmount;
};
