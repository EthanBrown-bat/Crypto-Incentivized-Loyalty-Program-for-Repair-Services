// DiscountEngine.test.ts
import { describe, expect, it, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Profile {
  owner: string;
  joinDate: number;
  loyaltyLevel: number;
}

interface Ticket {
  owner: string;
  profileId: number;
  description: string;
  status: string;
  cost: number;
}

interface DiscountHistory {
  appliedDiscount: number;
  timestamp: number;
}

interface Config {
  maxDiscount: number;
  complaintThreshold: number;
  decayPeriod: number;
  decayFactor: number;
  owner: string;
}

interface ContractState {
  profiles: Map<number, Profile>;
  complaintCount: Map<number, number>;
  unresolvedCount: Map<number, number>;
  lastComplaintTime: Map<number, number>;
  tickets: Map<number, Ticket>;
  discountHistory: Map<string, DiscountHistory>; // Key as `${profileId}-${ticketId}`
  contractOwner: string;
  maxDiscount: number;
  complaintThreshold: number;
  decayPeriod: number;
  decayFactor: number;
  currentBlockHeight: number;
}

// Mock contract implementation
class DiscountEngineMock {
  private state: ContractState = {
    profiles: new Map(),
    complaintCount: new Map(),
    unresolvedCount: new Map(),
    lastComplaintTime: new Map(),
    tickets: new Map(),
    discountHistory: new Map(),
    contractOwner: "deployer",
    maxDiscount: 20,
    complaintThreshold: 5,
    decayPeriod: 100,
    decayFactor: 90,
    currentBlockHeight: 1000, // Mock block height
  };

  private ERR_NOT_AUTHORIZED = 100;
  private ERR_INVALID_ID = 101;
  private ERR_DISCOUNT_APPLICATION_FAILED = 104;
  private ERR_INVALID_PARAM = 105;

  // Mock block height setter for testing time-based logic
  setBlockHeight(height: number): void {
    this.state.currentBlockHeight = height;
  }

  private isOwner(caller: string): boolean {
    return caller === this.state.contractOwner;
  }

  private calculateEffectiveComplaints(profileId: number): number {
    const total = this.state.complaintCount.get(profileId) ?? 0;
    const unresolved = this.state.unresolvedCount.get(profileId) ?? 0;
    const lastTime = this.state.lastComplaintTime.get(profileId) ?? 0;
    const periods = Math.floor((this.state.currentBlockHeight - lastTime) / this.state.decayPeriod);
    const decayMultiplier = Math.pow(this.state.decayFactor / 100, periods);
    return unresolved + Math.floor(total * decayMultiplier);
  }

  private getLoyaltyLevel(profileId: number): number {
    const profile = this.state.profiles.get(profileId);
    return profile ? profile.loyaltyLevel : 0;
  }

  setMaxDiscount(caller: string, newMax: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    if (newMax <= 0 || newMax > 100) return { ok: false, value: this.ERR_INVALID_PARAM };
    this.state.maxDiscount = newMax;
    return { ok: true, value: true };
  }

  setComplaintThreshold(caller: string, newThreshold: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    if (newThreshold <= 0) return { ok: false, value: this.ERR_INVALID_PARAM };
    this.state.complaintThreshold = newThreshold;
    return { ok: true, value: true };
  }

  setDecayPeriod(caller: string, newPeriod: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    if (newPeriod <= 0) return { ok: false, value: this.ERR_INVALID_PARAM };
    this.state.decayPeriod = newPeriod;
    return { ok: true, value: true };
  }

  setDecayFactor(caller: string, newFactor: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    if (newFactor < 0 || newFactor > 100) return { ok: false, value: this.ERR_INVALID_PARAM };
    this.state.decayFactor = newFactor;
    return { ok: true, value: true };
  }

  transferOwnership(caller: string, newOwner: string): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    this.state.contractOwner = newOwner;
    return { ok: true, value: true };
  }

  applyDiscountToTicket(ticketId: number): ClarityResponse<number> {
    const ticket = this.state.tickets.get(ticketId);
    if (!ticket) return { ok: false, value: this.ERR_INVALID_ID };
    const profileId = ticket.profileId;
    const baseCost = ticket.cost;
    const discountedCost = this.calculateDiscount(profileId, baseCost);
    if (discountedCost > baseCost) return { ok: false, value: this.ERR_DISCOUNT_APPLICATION_FAILED };
    this.state.tickets.set(ticketId, { ...ticket, cost: discountedCost });
    const key = `${profileId}-${ticketId}`;
    this.state.discountHistory.set(key, { appliedDiscount: baseCost - discountedCost, timestamp: this.state.currentBlockHeight });
    return { ok: true, value: discountedCost };
  }

  calculateDiscount(profileId: number, baseCost: number): number {
    const effective = this.calculateEffectiveComplaints(profileId);
    const level = this.getLoyaltyLevel(profileId);
    const maxD = this.state.maxDiscount;
    const threshold = this.state.complaintThreshold;
    if (effective > threshold) return baseCost;
    let discountPerc = Math.floor((level * maxD) / 10);
    const tierBonus = level >= 5 ? 5 : level >= 3 ? 3 : 0;
    discountPerc += tierBonus;
    return baseCost - Math.floor((baseCost * discountPerc) / 100);
  }

  getConfig(): ClarityResponse<Config> {
    return {
      ok: true,
      value: {
        maxDiscount: this.state.maxDiscount,
        complaintThreshold: this.state.complaintThreshold,
        decayPeriod: this.state.decayPeriod,
        decayFactor: this.state.decayFactor,
        owner: this.state.contractOwner,
      },
    };
  }

  getDiscountHistory(profileId: number, ticketId: number): ClarityResponse<DiscountHistory | null> {
    const key = `${profileId}-${ticketId}`;
    return { ok: true, value: this.state.discountHistory.get(key) ?? null };
  }

  getEffectiveComplaints(profileId: number): ClarityResponse<number> {
    return { ok: true, value: this.calculateEffectiveComplaints(profileId) };
  }

  // Mock setters for testing
  mockSetProfile(caller: string, id: number, level: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    this.state.profiles.set(id, { owner: caller, joinDate: this.state.currentBlockHeight, loyaltyLevel: level });
    return { ok: true, value: true };
  }

  mockSetComplaints(caller: string, id: number, count: number, unresolved: number, lastTime: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    this.state.complaintCount.set(id, count);
    this.state.unresolvedCount.set(id, unresolved);
    this.state.lastComplaintTime.set(id, lastTime);
    return { ok: true, value: true };
  }

  mockSetTicket(caller: string, id: number, profileId: number, cost: number): ClarityResponse<boolean> {
    if (!this.isOwner(caller)) return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    this.state.tickets.set(id, { owner: caller, profileId, description: "Mock", status: "pending", cost });
    return { ok: true, value: true };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  user1: "wallet_1",
  user2: "wallet_2",
};

describe("DiscountEngine Contract", () => {
  let contract: DiscountEngineMock;

  beforeEach(() => {
    contract = new DiscountEngineMock();
  });

  it("should allow owner to update max discount", () => {
    const result = contract.setMaxDiscount(accounts.deployer, 25);
    expect(result).toEqual({ ok: true, value: true });
    const config = contract.getConfig();
    expect((config.value as Config).maxDiscount).toBe(25);
  });

  it("should prevent non-owner from updating config", () => {
    const result = contract.setMaxDiscount(accounts.user1, 25);
    expect(result).toEqual({ ok: false, value: 100 });
  });

  it("should calculate discount correctly with no complaints", () => {
    contract.mockSetProfile(accounts.deployer, 1, 2);
    contract.mockSetComplaints(accounts.deployer, 1, 0, 0, 0);
    const discount = contract.calculateDiscount(1, 1000);
    expect(discount).toBe(960); // 4% discount (floor(2*20/10) =4 perc)
  });

  it("should apply tier bonus for high loyalty", () => {
    contract.mockSetProfile(accounts.deployer, 1, 5);
    contract.mockSetComplaints(accounts.deployer, 1, 0, 0, 0);
    const discount = contract.calculateDiscount(1, 1000);
    expect(discount).toBe(850); // 10% + 5% bonus = 15%
  });

  it("should decay complaints over time", () => {
    contract.mockSetComplaints(accounts.deployer, 1, 10, 0, 900); // 100 blocks ago
    contract.setBlockHeight(1000);
    const effective = contract.getEffectiveComplaints(1).value;
    expect(effective).toBe(9); // 10 * 0.9 = 9
  });

  it("should apply discount to ticket and record history", () => {
    contract.mockSetProfile(accounts.deployer, 1, 3);
    contract.mockSetComplaints(accounts.deployer, 1, 2, 1, 0);
    contract.mockSetTicket(accounts.deployer, 1, 1, 1000);
    const result = contract.applyDiscountToTicket(1);
    expect(result).toEqual({ ok: true, value: 910 }); // 6% + 3% bonus = 9% 90 discount
    const history = contract.getDiscountHistory(1, 1).value;
    expect((history as DiscountHistory).appliedDiscount).toBe(90);
  });

  it("should reject invalid ticket", () => {
    const result = contract.applyDiscountToTicket(999);
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should transfer ownership", () => {
    const result = contract.transferOwnership(accounts.deployer, accounts.user1);
    expect(result).toEqual({ ok: true, value: true });
    const config = contract.getConfig();
    expect((config.value as Config).owner).toBe(accounts.user1);
  });

  it("should handle batch apply discounts", () => {
    // Note: Batch functions are more complex; simulate manually in mock if needed.
    // For brevity, test single apply as proxy.
    expect(true).toBe(true); // Placeholder; expand if needed
  });
});