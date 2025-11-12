import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, stringAsciiCV, optionalCV, buffCV, tupleCV, listCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 300;
const ERR_INVALID_PROFILE_ID = 301;
const ERR_INVALID_COMPLAINT_ID = 302;
const ERR_INVALID_DESCRIPTION = 303;
const ERR_COMPLAINT_ALREADY_EXISTS = 304;
const ERR_COMPLAINT_NOT_FOUND = 305;
const ERR_COMPLAINT_ALREADY_RESOLVED = 306;
const ERR_INVALID_TIMESTAMP = 307;
const ERR_AUTHORITY_NOT_VERIFIED = 308;
const ERR_INVALID_RESOLVER = 309;
const ERR_INVALID_UPDATE_PARAM = 310;
const ERR_MAX_COMPLAINTS_EXCEEDED = 311;
const ERR_INVALID_SEVERITY = 312;
const ERR_INVALID_CATEGORY = 313;
const ERR_INVALID_STATUS = 314;
const ERR_INVALID_ATTACHMENT = 315;
const ERR_INVALID_RESPONSE = 316;
const ERR_INVALID_PRIORITY = 317;
const ERR_INVALID_LOCATION = 318;
const ERR_INVALID_EVIDENCE = 319;
const ERR_INVALID_FEE = 320;

interface Complaint {
  timestamp: number;
  description: string;
  resolved: boolean;
  severity: number;
  category: string;
  status: string;
  attachment: Uint8Array | null;
  response: string | null;
  priority: number;
  location: string | null;
  evidence: Uint8Array | null;
}

interface ComplaintUpdate {
  updateTimestamp: number;
  updater: string;
  newDescription: string;
  newSeverity: number;
  newPriority: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ComplaintRegistryMock {
  state: {
    contractOwner: string;
    nextComplaintGlobalId: number;
    maxComplaintsPerProfile: number;
    loggingFee: number;
    authorityContract: string | null;
    resolverFee: number;
    complaints: Map<string, Complaint>;
    complaintCount: Map<number, number>;
    resolvers: Map<string, boolean>;
    complaintUpdates: Map<string, ComplaintUpdate>;
    profileComplaintIds: Map<number, number[]>;
  } = {
    contractOwner: "ST1TEST",
    nextComplaintGlobalId: 0,
    maxComplaintsPerProfile: 100,
    loggingFee: 500,
    authorityContract: null,
    resolverFee: 100,
    complaints: new Map(),
    complaintCount: new Map(),
    resolvers: new Map(),
    complaintUpdates: new Map(),
    profileComplaintIds: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  nftOwners: Map<number, string> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      contractOwner: "ST1TEST",
      nextComplaintGlobalId: 0,
      maxComplaintsPerProfile: 100,
      loggingFee: 500,
      authorityContract: null,
      resolverFee: 100,
      complaints: new Map(),
      complaintCount: new Map(),
      resolvers: new Map(),
      complaintUpdates: new Map(),
      profileComplaintIds: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.nftOwners = new Map();
  }

  setNftOwner(profileId: number, owner: string) {
    this.nftOwners.set(profileId, owner);
  }

  getNftOwner(profileId: number): string | null {
    return this.nftOwners.get(profileId) || null;
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxComplaintsPerProfile(newMax: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.maxComplaintsPerProfile = newMax;
    return { ok: true, value: true };
  }

  setLoggingFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_FEE };
    this.state.loggingFee = newFee;
    return { ok: true, value: true };
  }

  addResolver(who: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.resolvers.set(who, true);
    return { ok: true, value: true };
  }

  removeResolver(who: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.resolvers.delete(who);
    return { ok: true, value: true };
  }

  logComplaint(
    profileId: number,
    description: string,
    severity: number,
    category: string,
    attachment: Uint8Array | null,
    priority: number,
    location: string | null,
    evidence: Uint8Array | null
  ): Result<number> {
    if (profileId <= 0) return { ok: false, value: ERR_INVALID_PROFILE_ID };
    if (description.length === 0 || description.length > 512) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (severity < 1 || severity > 5) return { ok: false, value: ERR_INVALID_SEVERITY };
    if (!["service", "product", "billing", "other"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (attachment && attachment.length > 1024) return { ok: false, value: ERR_INVALID_ATTACHMENT };
    if (priority < 1 || priority > 3) return { ok: false, value: ERR_INVALID_PRIORITY };
    if (location && location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (evidence && evidence.length > 2048) return { ok: false, value: ERR_INVALID_EVIDENCE };
    const currentCount = this.state.complaintCount.get(profileId) || 0;
    if (currentCount >= this.state.maxComplaintsPerProfile) return { ok: false, value: ERR_MAX_COMPLAINTS_EXCEEDED };
    const owner = this.getNftOwner(profileId);
    if (owner === null || this.caller !== owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.authorityContract === null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.stxTransfers.push({ amount: this.state.loggingFee, from: this.caller, to: this.state.authorityContract });
    const newComplaintId = currentCount + 1;
    const key = `${profileId}-${newComplaintId}`;
    this.state.complaints.set(key, {
      timestamp: this.blockHeight,
      description,
      resolved: false,
      severity,
      category,
      status: "open",
      attachment,
      response: null,
      priority,
      location,
      evidence,
    });
    this.state.complaintCount.set(profileId, newComplaintId);
    const currentIds = this.state.profileComplaintIds.get(profileId) || [];
    this.state.profileComplaintIds.set(profileId, [...currentIds, newComplaintId]);
    this.state.nextComplaintGlobalId++;
    return { ok: true, value: newComplaintId };
  }

  resolveComplaint(profileId: number, complaintId: number, response: string): Result<boolean> {
    if (profileId <= 0) return { ok: false, value: ERR_INVALID_PROFILE_ID };
    if (complaintId <= 0) return { ok: false, value: ERR_INVALID_COMPLAINT_ID };
    if (response.length > 512) return { ok: false, value: ERR_INVALID_RESPONSE };
    const key = `${profileId}-${complaintId}`;
    const complaint = this.state.complaints.get(key);
    if (!complaint) return { ok: false, value: ERR_COMPLAINT_NOT_FOUND };
    if (complaint.resolved) return { ok: false, value: ERR_COMPLAINT_ALREADY_RESOLVED };
    if (!this.state.resolvers.get(this.caller)) return { ok: false, value: ERR_INVALID_RESOLVER };
    this.state.complaints.set(key, {
      ...complaint,
      resolved: true,
      status: "closed",
      response,
    });
    return { ok: true, value: true };
  }

  updateComplaint(
    profileId: number,
    complaintId: number,
    newDescription: string,
    newSeverity: number,
    newPriority: number
  ): Result<boolean> {
    if (profileId <= 0) return { ok: false, value: ERR_INVALID_PROFILE_ID };
    if (complaintId <= 0) return { ok: false, value: ERR_INVALID_COMPLAINT_ID };
    if (newDescription.length === 0 || newDescription.length > 512) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (newSeverity < 1 || newSeverity > 5) return { ok: false, value: ERR_INVALID_SEVERITY };
    if (newPriority < 1 || newPriority > 3) return { ok: false, value: ERR_INVALID_PRIORITY };
    const key = `${profileId}-${complaintId}`;
    const complaint = this.state.complaints.get(key);
    if (!complaint) return { ok: false, value: ERR_COMPLAINT_NOT_FOUND };
    if (complaint.resolved) return { ok: false, value: ERR_COMPLAINT_ALREADY_RESOLVED };
    const owner = this.getNftOwner(profileId);
    if (owner === null || this.caller !== owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.complaints.set(key, {
      ...complaint,
      timestamp: this.blockHeight,
      description: newDescription,
      severity: newSeverity,
      priority: newPriority,
    });
    this.state.complaintUpdates.set(key, {
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      newDescription,
      newSeverity,
      newPriority,
    });
    return { ok: true, value: true };
  }

  getUnresolvedCount(profileId: number): number {
    const count = this.state.complaintCount.get(profileId) || 0;
    let unresolved = 0;
    for (let i = 1; i <= count; i++) {
      const key = `${profileId}-${i}`;
      const complaint = this.state.complaints.get(key);
      if (complaint && !complaint.resolved) unresolved++;
    }
    return unresolved;
  }

  getAllComplaintIds(profileId: number): number[] {
    return this.state.profileComplaintIds.get(profileId) || [];
  }

  deleteComplaint(profileId: number, complaintId: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const key = `${profileId}-${complaintId}`;
    if (!this.state.complaints.has(key)) return { ok: false, value: ERR_COMPLAINT_NOT_FOUND };
    this.state.complaints.delete(key);
    const currentCount = this.state.complaintCount.get(profileId) || 0;
    this.state.complaintCount.set(profileId, currentCount - 1);
    const ids = this.state.profileComplaintIds.get(profileId) || [];
    this.state.profileComplaintIds.set(profileId, ids.filter(id => id !== complaintId));
    return { ok: true, value: true };
  }

  setResolverFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_FEE };
    this.state.resolverFee = newFee;
    return { ok: true, value: true };
  }

  getGlobalComplaintCount(): number {
    return this.state.nextComplaintGlobalId;
  }

  getLoggingFee(): number {
    return this.state.loggingFee;
  }

  getResolverFee(): number {
    return this.state.resolverFee;
  }

  getMaxComplaintsPerProfile(): number {
    return this.state.maxComplaintsPerProfile;
  }

  getComplaint(profileId: number, complaintId: number): Complaint | null {
    const key = `${profileId}-${complaintId}`;
    return this.state.complaints.get(key) || null;
  }

  getComplaintUpdates(profileId: number, complaintId: number): ComplaintUpdate | null {
    const key = `${profileId}-${complaintId}`;
    return this.state.complaintUpdates.get(key) || null;
  }

  isResolver(who: string): boolean {
    return this.state.resolvers.get(who) || false;
  }
}

describe("ComplaintRegistry", () => {
  let contract: ComplaintRegistryMock;

  beforeEach(() => {
    contract = new ComplaintRegistryMock();
    contract.reset();
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects setting authority contract if already set", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setAuthorityContract("ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects setting authority contract by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setAuthorityContract("ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets max complaints per profile successfully", () => {
    const result = contract.setMaxComplaintsPerProfile(50);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxComplaintsPerProfile).toBe(50);
  });

  it("rejects setting max complaints per profile to zero", () => {
    const result = contract.setMaxComplaintsPerProfile(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("rejects setting max complaints per profile by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setMaxComplaintsPerProfile(50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets logging fee successfully", () => {
    const result = contract.setLoggingFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.loggingFee).toBe(1000);
  });

  it("rejects setting negative logging fee", () => {
    const result = contract.setLoggingFee(-100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FEE);
  });

  it("rejects setting logging fee by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setLoggingFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("adds resolver successfully", () => {
    const result = contract.addResolver("ST3RESOLVER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.isResolver("ST3RESOLVER")).toBe(true);
  });

  it("rejects adding resolver by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.addResolver("ST3RESOLVER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("removes resolver successfully", () => {
    contract.addResolver("ST3RESOLVER");
    const result = contract.removeResolver("ST3RESOLVER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.isResolver("ST3RESOLVER")).toBe(false);
  });

  it("rejects removing resolver by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.removeResolver("ST3RESOLVER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("logs complaint successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
    const complaint = contract.getComplaint(1, 1);
    expect(complaint?.description).toBe("Bad service");
    expect(complaint?.severity).toBe(3);
    expect(complaint?.category).toBe("service");
    expect(complaint?.priority).toBe(2);
    expect(complaint?.location).toBe("Store A");
    expect(complaint?.resolved).toBe(false);
    expect(complaint?.status).toBe("open");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2AUTH" }]);
    expect(contract.getAllComplaintIds(1)).toEqual([1]);
    expect(contract.getGlobalComplaintCount()).toBe(1);
  });

  it("rejects logging complaint without authority contract", () => {
    contract.setNftOwner(1, "ST1TEST");
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects logging complaint by non-owner", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST3OWNER");
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects logging complaint with invalid profile id", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(0, "ST1TEST");
    const result = contract.logComplaint(
      0,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROFILE_ID);
  });

  it("rejects logging complaint with empty description", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const result = contract.logComplaint(
      1,
      "",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESCRIPTION);
  });

  it("rejects logging complaint with invalid severity", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const result = contract.logComplaint(
      1,
      "Bad service",
      6,
      "service",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SEVERITY);
  });

  it("rejects logging complaint with invalid category", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "invalid",
      null,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("rejects logging complaint with oversized attachment", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const largeBuff = new Uint8Array(1025);
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      largeBuff,
      2,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ATTACHMENT);
  });

  it("rejects logging complaint with invalid priority", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      4,
      "Store A",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRIORITY);
  });

  it("rejects logging complaint with oversized location", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const longLocation = "A".repeat(101);
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      longLocation,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LOCATION);
  });

  it("rejects logging complaint with oversized evidence", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    const largeEvidence = new Uint8Array(2049);
    const result = contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      largeEvidence
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EVIDENCE);
  });

  it("rejects logging complaint when max exceeded", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.state.maxComplaintsPerProfile = 1;
    contract.logComplaint(
      1,
      "First",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    const result = contract.logComplaint(
      1,
      "Second",
      3,
      "service",
      null,
      2,
      "Store B",
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_COMPLAINTS_EXCEEDED);
  });

  it("resolves complaint successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.addResolver("ST1TEST");
    const result = contract.resolveComplaint(1, 1, "Fixed");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const complaint = contract.getComplaint(1, 1);
    expect(complaint?.resolved).toBe(true);
    expect(complaint?.status).toBe("closed");
    expect(complaint?.response).toBe("Fixed");
  });

  it("rejects resolving non-existent complaint", () => {
    contract.addResolver("ST1TEST");
    const result = contract.resolveComplaint(1, 1, "Fixed");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_COMPLAINT_NOT_FOUND);
  });

  it("rejects resolving already resolved complaint", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.addResolver("ST1TEST");
    contract.resolveComplaint(1, 1, "Fixed");
    const result = contract.resolveComplaint(1, 1, "Fixed again");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_COMPLAINT_ALREADY_RESOLVED);
  });

  it("rejects resolving by non-resolver", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    const result = contract.resolveComplaint(1, 1, "Fixed");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RESOLVER);
  });

  it("rejects resolving with invalid profile id", () => {
    contract.addResolver("ST1TEST");
    const result = contract.resolveComplaint(0, 1, "Fixed");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROFILE_ID);
  });

  it("rejects resolving with invalid complaint id", () => {
    contract.addResolver("ST1TEST");
    const result = contract.resolveComplaint(1, 0, "Fixed");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_COMPLAINT_ID);
  });

  it("rejects resolving with oversized response", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.addResolver("ST1TEST");
    const longResponse = "A".repeat(513);
    const result = contract.resolveComplaint(1, 1, longResponse);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RESPONSE);
  });

  it("updates complaint successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    const result = contract.updateComplaint(1, 1, "Worse service", 4, 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const complaint = contract.getComplaint(1, 1);
    expect(complaint?.description).toBe("Worse service");
    expect(complaint?.severity).toBe(4);
    expect(complaint?.priority).toBe(1);
    const update = contract.getComplaintUpdates(1, 1);
    expect(update?.newDescription).toBe("Worse service");
    expect(update?.newSeverity).toBe(4);
    expect(update?.newPriority).toBe(1);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects updating non-existent complaint", () => {
    const result = contract.updateComplaint(1, 1, "Update", 4, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_COMPLAINT_NOT_FOUND);
  });

  it("rejects updating resolved complaint", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.addResolver("ST1TEST");
    contract.resolveComplaint(1, 1, "Fixed");
    const result = contract.updateComplaint(1, 1, "Update", 4, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_COMPLAINT_ALREADY_RESOLVED);
  });

  it("rejects updating with invalid description", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    const result = contract.updateComplaint(1, 1, "", 4, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESCRIPTION);
  });

  it("rejects updating with invalid severity", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    const result = contract.updateComplaint(1, 1, "Update", 6, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SEVERITY);
  });

  it("rejects updating with invalid priority", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    const result = contract.updateComplaint(1, 1, "Update", 4, 4);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRIORITY);
  });

  it("gets unresolved count correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "First",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.logComplaint(
      1,
      "Second",
      4,
      "product",
      null,
      1,
      "Store B",
      null
    );
    contract.addResolver("ST1TEST");
    contract.resolveComplaint(1, 1, "Fixed");
    const count = contract.getUnresolvedCount(1);
    expect(count).toBe(1);
  });

  it("gets all complaint ids correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "First",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.logComplaint(
      1,
      "Second",
      4,
      "product",
      null,
      1,
      "Store B",
      null
    );
    const ids = contract.getAllComplaintIds(1);
    expect(ids).toEqual([1, 2]);
  });
  
  it("rejects deleting non-existent complaint", () => {
    const result = contract.deleteComplaint(1, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_COMPLAINT_NOT_FOUND);
  });

  it("rejects deleting complaint by non-owner", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "Bad service",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.caller = "ST2FAKE";
    const result = contract.deleteComplaint(1, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets resolver fee successfully", () => {
    const result = contract.setResolverFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.resolverFee).toBe(200);
  });

  it("rejects setting negative resolver fee", () => {
    const result = contract.setResolverFee(-100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FEE);
  });

  it("rejects setting resolver fee by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setResolverFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("gets global complaint count correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setNftOwner(1, "ST1TEST");
    contract.logComplaint(
      1,
      "First",
      3,
      "service",
      null,
      2,
      "Store A",
      null
    );
    contract.logComplaint(
      1,
      "Second",
      4,
      "product",
      null,
      1,
      "Store B",
      null
    );
    expect(contract.getGlobalComplaintCount()).toBe(2);
  });

  it("gets logging fee correctly", () => {
    expect(contract.getLoggingFee()).toBe(500);
  });

  it("gets resolver fee correctly", () => {
    expect(contract.getResolverFee()).toBe(100);
  });

  it("gets max complaints per profile correctly", () => {
    expect(contract.getMaxComplaintsPerProfile()).toBe(100);
  });

  it("parses complaint parameters with Clarity types", () => {
    const desc = stringAsciiCV("Test desc");
    const sev = uintCV(3);
    const cat = stringAsciiCV("service");
    const pri = uintCV(2);
    expect(desc.value).toBe("Test desc");
    expect(sev.value).toEqual(BigInt(3));
    expect(cat.value).toBe("service");
    expect(pri.value).toEqual(BigInt(2));
  });

  it("handles list of complaint ids in Clarity", () => {
    const ids = listCV([uintCV(1), uintCV(2)]);
    expect(ids.value.length).toBe(2);
  });

  it("handles tuple for complaint key", () => {
    const key = tupleCV({ "profile-id": uintCV(1), "complaint-id": uintCV(1) });
    expect(key.value["profile-id"].value).toEqual(BigInt(1));
  });
});