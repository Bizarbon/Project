function numberEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
}

function installmentPolicy() {
    const terms = String(process.env.INSTALLMENT_TERMS || '3,6,9,12')
        .split(',')
        .map(value => Number(value.trim()))
        .filter(value => Number.isInteger(value) && value > 0 && value <= 36);
    return {
        terms: [...new Set(terms.length ? terms : [3, 6, 9, 12])].sort((a, b) => a - b),
        downPaymentPercent: Math.min(Math.max(numberEnv('INSTALLMENT_DOWN_PAYMENT_PERCENT', 30), 0), 100),
        annualRatePercent: Math.max(numberEnv('INSTALLMENT_ANNUAL_RATE_PERCENT', 0), 0),
        policyName: String(process.env.INSTALLMENT_POLICY_NAME || 'Dự tính trả góp nội bộ').trim(),
        isEstimate: true
    };
}

function quoteInstallments(amount) {
    const normalizedAmount = Math.max(Math.round(Number(amount) || 0), 0);
    if (!normalizedAmount) {
        const error = new Error('Số tiền cần tính trả góp phải lớn hơn 0.');
        error.statusCode = 400;
        throw error;
    }
    const policy = installmentPolicy();
    const downPayment = Math.round(normalizedAmount * policy.downPaymentPercent / 100);
    const financedAmount = normalizedAmount - downPayment;
    const plans = policy.terms.map(term => {
        const totalInterest = Math.round(financedAmount * (policy.annualRatePercent / 100) * (term / 12));
        const installmentTotal = financedAmount + totalInterest;
        const monthlyPayment = Math.ceil(installmentTotal / term);
        const lastPayment = Math.max(installmentTotal - monthlyPayment * (term - 1), 0);
        return {
            term,
            downPayment,
            financedAmount,
            annualRatePercent: policy.annualRatePercent,
            totalInterest,
            monthlyPayment,
            lastPayment,
            totalPayable: downPayment + installmentTotal
        };
    });
    return { amount: normalizedAmount, policy, plans };
}

function selectedInstallmentPlan(amount, term) {
    const quote = quoteInstallments(amount);
    const plan = quote.plans.find(item => item.term === Number(term));
    if (!plan) {
        const error = new Error(`Kỳ hạn trả góp phải thuộc: ${quote.policy.terms.join(', ')} tháng.`);
        error.statusCode = 400;
        throw error;
    }
    return { ...plan, policyName: quote.policy.policyName, isEstimate: quote.policy.isEstimate };
}

module.exports = { installmentPolicy, quoteInstallments, selectedInstallmentPlan };
