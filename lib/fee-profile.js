// Consensus v0.6 starting fee budgets. Every phase time is clamped to 30..600 in fees.js.
// These are starting estimates, not measured production fee guarantees.
const base = { leaderTimeunitsAllocation: "125", validatorTimeunitsAllocation: "250", totalMessageFees: "0", rotationsPerRound: "1" };
const heavy = { ...base, leaderTimeunitsAllocation: "500", validatorTimeunitsAllocation: "600" };
export default {
  version: 1, network: "studio-next", deploy: { ...base },
  methods: {
    create_claim: { ...base }, challenge: { ...base }, cancel: { ...base }, request_refund: { ...base },
    resolve: { ...heavy }, withdraw: { ...base, totalMessageFees: "800000" },
  },
};
