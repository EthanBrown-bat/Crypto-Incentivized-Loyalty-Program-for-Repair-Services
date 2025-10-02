# LoyalChain: Crypto-Incentivized Loyalty Program for Repair Services

## Overview

LoyalChain is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It implements a crypto-incentivized loyalty program for repeat customers in service-based industries, such as electronics repair, auto maintenance, or IT support. The core idea is to reward loyal customers with tokenized incentives (LCT tokens) and provide dynamic discounts on virtual support or in-person repairs based on their complaint history. 

### Real-World Problems Solved
- **Lack of Transparency in Loyalty Programs**: Traditional loyalty systems are opaque, controlled by centralized entities, and prone to manipulation. LoyalChain uses blockchain for immutable tracking of customer interactions, ensuring fair rewards and discounts.
- **Customer Retention Challenges**: Businesses struggle to retain repeat customers due to inconsistent service experiences. By tying discounts to complaint history (e.g., fewer complaints lead to higher discounts), the system incentivizes positive feedback loops—customers are rewarded for loyalty, and businesses gain insights to improve services.
- **Inefficient Dispute Resolution**: Complaint histories are often siloed or disputed. LoyalChain's decentralized registry allows verifiable logging, reducing fraud and enabling automated, history-based pricing.
- **Low Engagement in Service Industries**: Crypto incentives (tokens earnable via staking or referrals) encourage repeat business, turning one-time customers into loyal ones while providing liquid rewards that can be traded or staked.
- **Global Accessibility**: Supports cross-border services with borderless crypto payments and discounts, solving issues in fragmented markets like international tech support.

The project leverages Stacks' integration with Bitcoin for security and scalability, making it suitable for real-world adoption in repair shops or online support platforms.

## Key Features
- **Tokenized Loyalty**: Customers earn LCT (LoyalChain Token) for repeat visits, referrals, or low-complaint records.
- **History-Based Discounts**: Discounts on repairs/support are calculated algorithmically based on complaint frequency and resolution status (e.g., 10% off for <5 complaints in the last year).
- **Immutable Records**: All interactions (repairs, complaints) are logged on-chain for transparency.
- **Staking for Extra Rewards**: Stake LCT to earn bonus discounts or governance rights.
- **DAO Governance**: Token holders vote on program parameters like discount thresholds.

## Architecture
LoyalChain consists of 7 interconnected Clarity smart contracts, designed for modularity, security, and efficiency. Each contract handles a specific aspect of the system, with traits for interoperability (e.g., SIP-10 for tokens, SIP-09 for NFTs).

### Smart Contracts
1. **LoyaltyToken.clar**: SIP-10 compliant fungible token contract for LCT rewards.
2. **CustomerProfile.clar**: SIP-09 NFT contract for unique customer profiles.
3. **ComplaintRegistry.clar**: Logs and queries customer complaints immutably.
4. **RepairTicket.clar**: Manages repair requests and resolutions as NFTs.
5. **DiscountEngine.clar**: Computes discounts based on history data.
6. **RewardsDistributor.clar**: Handles token minting and distribution based on loyalty milestones.
7. **Governance.clar**: DAO-style voting for parameter updates.

Contracts are deployed on Stacks and interact via principal-based permissions. Only authorized principals (e.g., business owners) can mint tokens or log repairs, while customers control their profiles.

## Installation and Deployment
### Prerequisites
- Stacks Wallet (e.g., Hiro Wallet)
- Clarinet (Stacks dev tool) for local testing
- Node.js for any frontend integration (not included here)

### Steps
1. Install Clarinet: `cargo install clarinet`
2. Clone the repo: `git clone <repo-url>`
3. Navigate to project: `cd loyalchain`
4. Test locally: `clarinet test`
5. Deploy to Stacks testnet: Use Clarinet or Stacks CLI to deploy each contract.
6. Interact via Stacks Explorer or a custom dApp.

## Usage
- **For Customers**: Mint a CustomerProfile NFT to join. Submit repairs via RepairTicket, log complaints if needed. Earn LCT via RewardsDistributor for milestones (e.g., 5 repairs). Use DiscountEngine for discounted service quotes.
- **For Businesses**: Deploy as a service provider. Use principal to approve repairs and distribute rewards.
- **Example Flow**:
  1. Customer mints profile.
  2. Submits repair ticket.
  3. If resolved without complaint, earn LCT.
  4. On next repair, query DiscountEngine for discount based on low complaints.
  5. Stake LCT for bonuses via Governance.

## Smart Contract Details and Code

Below is the source code for each contract in Clarity. These are production-ready skeletons—audit before mainnet deployment.

### 1. LoyaltyToken.clar (SIP-10 Fungible Token)
```clarity
;; LoyaltyToken - SIP-10 Fungible Token for LCT

(define-fungible-token lct u1000000000) ;; Max supply: 1 billion

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (try! (ft-transfer? lct amount sender recipient))
    (match memo value (print value) 0x)
    (ok true)
  )
)

(define-public (get-name)
  (ok "LoyalChain Token")
)

(define-public (get-symbol)
  (ok "LCT")
)

(define-public (get-decimals)
  (ok u6)
)

(define-public (get-balance (who principal))
  (ok (ft-get-balance lct who))
)

(define-public (get-total-supply)
  (ok (ft-get-supply lct))
)

(define-public (get-token-uri)
  (ok (some "https://loyalchain.example/token-metadata.json"))
)

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? lct amount recipient)
  )
)
```

### 2. CustomerProfile.clar (SIP-09 NFT for Profiles)
```clarity
;; CustomerProfile - SIP-09 NFT for unique customer identities

(define-non-fungible-token customer-profile uint)
(define-map profiles uint { owner: principal, join-date: uint, loyalty-level: uint })
(define-data-var last-id uint u0)
(define-constant err-not-owner (err u200))
(define-constant err-invalid-id (err u201))

(define-public (mint-profile (owner principal))
  (let ((new-id (+ (var-get last-id) u1)))
    (try! (nft-mint? customer-profile new-id owner))
    (map-set profiles new-id { owner: owner, join-date: block-height, loyalty-level: u1 })
    (var-set last-id new-id)
    (ok new-id)
  )
)

(define-public (transfer (id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq (unwrap! (map-get? profiles id) err-invalid-id).owner sender) err-not-owner)
    (try! (nft-transfer? customer-profile id sender recipient))
    (map-set profiles id { owner: recipient, join-date: (unwrap! (map-get? profiles id) err-invalid-id).join-date, loyalty-level: (unwrap! (map-get? profiles id) err-invalid-id).loyalty-level })
    (ok true)
  )
)

(define-read-only (get-last-token-id)
  (ok (var-get last-id))
)

(define-read-only (get-token-uri (id uint))
  (ok (some "https://loyalchain.example/profile-metadata.json"))
)

(define-read-only (get-owner (id uint))
  (ok (nft-get-owner? customer-profile id))
)

(define-public (update-loyalty-level (id uint) (new-level uint))
  (let ((profile (unwrap! (map-get? profiles id) err-invalid-id)))
    (asserts! (is-eq tx-sender profile.owner) err-not-owner)
    (map-set profiles id { owner: profile.owner, join-date: profile.join-date, loyalty-level: new-level })
    (ok true)
  )
)
```

### 3. ComplaintRegistry.clar (Immutable Complaint Logging)
```clarity
;; ComplaintRegistry - Logs complaints tied to profiles

(define-map complaints { profile-id: uint, complaint-id: uint } { timestamp: uint, description: (string-ascii 256), resolved: bool })
(define-map complaint-count uint uint)
(define-constant err-not-profile-owner (err u300))

(define-public (log-complaint (profile-id uint) (description (string-ascii 256)))
  (let ((owner (unwrap! (principal-of? (unwrap! (nft-get-owner? customer-profile profile-id) err-invalid-id)) err-invalid-id))
        (new-complaint-id (+ (default-to u0 (map-get? complaint-count profile-id)) u1)))
    (asserts! (is-eq tx-sender owner) err-not-profile-owner)
    (map-set complaints { profile-id: profile-id, complaint-id: new-complaint-id } { timestamp: block-height, description: description, resolved: false })
    (map-set complaint-count profile-id new-complaint-id)
    (ok new-complaint-id)
  )
)

(define-public (resolve-complaint (profile-id uint) (complaint-id uint))
  (let ((complaint (unwrap! (map-get? complaints { profile-id: profile-id, complaint-id: complaint-id }) err-invalid-id)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only) ;; Business resolves
    (map-set complaints { profile-id: profile-id, complaint-id: complaint-id } { timestamp: complaint.timestamp, description: complaint.description, resolved: true })
    (ok true)
  )
)

(define-read-only (get-complaint-count (profile-id uint))
  (ok (default-to u0 (map-get? complaint-count profile-id)))
)

(define-read-only (get-unresolved-count (profile-id uint))
  (fold + (map (lambda (id) (if (not (unwrap! (map-get? complaints { profile-id: profile-id, complaint-id: id }).resolved false)) u1 u0)) (range u1 (get-complaint-count profile-id))) u0)
)
```

### 4. RepairTicket.clar (Repair Requests as NFTs)
```clarity
;; RepairTicket - NFT for repair tickets

(define-non-fungible-token repair-ticket uint)
(define-map tickets uint { owner: principal, profile-id: uint, description: (string-ascii 256), status: (string-ascii 20), cost: uint })
(define-data-var ticket-id uint u0)
(define-constant err-invalid-ticket (err u400))

(define-public (create-ticket (profile-id uint) (description (string-ascii 256)) (cost uint))
  (let ((new-id (+ (var-get ticket-id) u1)))
    (try! (nft-mint? repair-ticket new-id tx-sender))
    (map-set tickets new-id { owner: tx-sender, profile-id: profile-id, description: description, status: "pending", cost: cost })
    (var-set ticket-id new-id)
    (ok new-id)
  )
)

(define-public (resolve-ticket (ticket-id uint) (new-status (string-ascii 20)))
  (let ((ticket (unwrap! (map-get? tickets ticket-id) err-invalid-ticket)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only) ;; Business resolves
    (map-set tickets ticket-id { owner: ticket.owner, profile-id: ticket.profile-id, description: ticket.description, status: new-status, cost: ticket.cost })
    (ok true)
  )
)

(define-read-only (get-ticket (ticket-id uint))
  (map-get? tickets ticket-id)
)
```

### 5. DiscountEngine.clar (Calculates Discounts)
```clarity
;; DiscountEngine - Computes discounts based on history

(define-constant max-discount u20) ;; 20% max
(define-constant complaint-threshold u5) ;; Over 5 complaints: no discount

(define-read-only (calculate-discount (profile-id uint) (base-cost uint))
  (let ((complaints (get-complaint-count profile-id))
        (unresolved (get-unresolved-count profile-id))
        (level (unwrap! (map-get? profiles profile-id).loyalty-level u0)))
    (if (> (+ complaints unresolved) complaint-threshold)
      base-cost
      (- base-cost (* base-cost (/ (* level max-discount) u100)))
    )
  )
)

(define-public (apply-discount-to-ticket (ticket-id uint))
  (let ((ticket (unwrap! (map-get? tickets ticket-id) err-invalid-ticket))
        (discounted-cost (calculate-discount ticket.profile-id ticket.cost)))
    (map-set tickets ticket-id { owner: ticket.owner, profile-id: ticket.profile-id, description: ticket.description, status: ticket.status, cost: discounted-cost })
    (ok discounted-cost)
  )
)
```

### 6. RewardsDistributor.clar (Token Distribution)
```clarity
;; RewardsDistributor - Distributes LCT based on milestones

(define-constant reward-per-repair u100) ;; 100 LCT per resolved repair
(define-map repair-count uint uint)

(define-public (distribute-reward (profile-id uint) (ticket-id uint))
  (let ((ticket (unwrap! (map-get? tickets ticket-id) err-invalid-ticket))
        (new-count (+ (default-to u0 (map-get? repair-count profile-id)) u1)))
    (asserts! (is-eq ticket.status "resolved") err-invalid-ticket)
    (asserts! (is-eq ticket.profile-id profile-id) err-invalid-id)
    (try! (mint (* reward-per-repair new-count) (unwrap! (nft-get-owner? customer-profile profile-id) err-invalid-id)))
    (map-set repair-count profile-id new-count)
    (ok true)
  )
)

(define-read-only (get-repair-count (profile-id uint))
  (default-to u0 (map-get? repair-count profile-id))
)
```

### 7. Governance.clar (DAO Voting)
```clarity
;; Governance - Token-based voting for parameters

(define-map proposals uint { proposer: principal, description: (string-ascii 256), yes-votes: uint, no-votes: uint, end-height: uint })
(define-data-var proposal-id uint u0)
(define-map votes { proposal-id: uint, voter: principal } bool)
(define-constant min-stake u1000) ;; Min LCT to vote
(define-constant err-already-voted (err u500))
(define-constant err-proposal-ended (err u501))

(define-public (create-proposal (description (string-ascii 256)) (duration uint))
  (let ((new-id (+ (var-get proposal-id) u1)))
    (asserts! (>= (ft-get-balance lct tx-sender) min-stake) err-not-token-owner)
    (map-set proposals new-id { proposer: tx-sender, description: description, yes-votes: u0, no-votes: u0, end-height: (+ block-height duration) })
    (var-set proposal-id new-id)
    (ok new-id)
  )
)

(define-public (vote (proposal-id uint) (vote-yes bool))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) err-invalid-id)))
    (asserts! (< block-height proposal.end-height) err-proposal-ended)
    (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: tx-sender })) err-already-voted)
    (asserts! (>= (ft-get-balance lct tx-sender) min-stake) err-not-token-owner)
    (if vote-yes
      (map-set proposals proposal-id { proposer: proposal.proposer, description: proposal.description, yes-votes: (+ proposal.yes-votes u1), no-votes: proposal.no-votes, end-height: proposal.end-height })
      (map-set proposals proposal-id { proposer: proposal.proposer, description: proposal.description, yes-votes: proposal.yes-votes, no-votes: (+ proposal.no-votes u1), end-height: proposal.end-height })
    )
    (map-set votes { proposal-id: proposal-id, voter: tx-sender } vote-yes)
    (ok true)
  )
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)
```

## Security Considerations
- Use principal checks to prevent unauthorized actions.
- Avoid reentrancy with careful function ordering.
- Audit for overflows (Clarity handles uint safely).
- Test for edge cases like high complaint counts or zero balances.

## Future Enhancements
- Integrate with Bitcoin L2 for cross-chain rewards.
- Frontend dApp for user-friendly interactions.
- Oracle for off-chain repair verifications.

## License
MIT License. See LICENSE file for details.