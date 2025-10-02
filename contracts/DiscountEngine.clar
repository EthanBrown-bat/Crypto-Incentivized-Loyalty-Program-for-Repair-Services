;; DiscountEngine.clar
;; Core contract for calculating and applying dynamic discounts based on customer complaint history and loyalty.
;; Integrates with external contracts for profiles, complaints, and tickets.
;; Expanded for sophistication: configurable parameters, tiered discounts, time-based decay, access control, event logging.

;; Constants
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-ID (err u101))
(define-constant ERR-INVALID-AMOUNT (err u102))
(define-constant ERR-CONFIG-UPDATE-FAILED (err u103))
(define-constant ERR-DISCOUNT-APPLICATION-FAILED (err u104))
(define-constant ERR-INVALID-PARAM (err u105))
(define-constant ERR-NOT-OWNER (err u106))

;; Default values
(define-constant DEFAULT-MAX-DISCOUNT u20) ;; 20% max discount
(define-constant DEFAULT-COMPLAINT-THRESHOLD u5) ;; Over 5 complaints: no discount
(define-constant DEFAULT-DECAY-PERIOD u100) ;; Blocks per decay period
(define-constant DEFAULT-DECAY-FACTOR u90) ;; 90% retention per period (10% decay)

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-data-var max-discount uint DEFAULT-MAX-DISCOUNT)
(define-data-var complaint-threshold uint DEFAULT-COMPLAINT-THRESHOLD)
(define-data-var decay-period uint DEFAULT-DECAY-PERIOD)
(define-data-var decay-factor uint DEFAULT-DECAY-FACTOR)

;; Data Maps
;; Assume external maps from other contracts; in practice, use traits for integration.
;; For standalone sophistication, define mock interfaces here.
(define-map profiles uint { owner: principal, join-date: uint, loyalty-level: uint })
(define-map complaint-count uint uint) ;; Total complaints per profile
(define-map unresolved-count uint uint) ;; Unresolved complaints per profile
(define-map last-complaint-time uint uint) ;; Last complaint timestamp (block-height) per profile
(define-map tickets uint { owner: principal, profile-id: uint, description: (string-ascii 256), status: (string-ascii 20), cost: uint })
(define-map discount-history { profile-id: uint, ticket-id: uint } { applied-discount: uint, timestamp: uint })

;; Private Functions
(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
)

(define-private (calculate-effective-complaints (profile-id uint))
  (let (
    (total-complaints (default-to u0 (map-get? complaint-count profile-id)))
    (unresolved (default-to u0 (map-get? unresolved-count profile-id)))
    (last-time (default-to u0 (map-get? last-complaint-time profile-id)))
    (periods-elapsed (/ (- block-height last-time) (var-get decay-period)))
    (decay-multiplier (pow (var-get decay-factor) periods-elapsed))
  )
    (+ unresolved (/ (* total-complaints decay-multiplier) u100))
  )
)

(define-private (get-loyalty-level (profile-id uint))
  (let ((profile (map-get? profiles profile-id)))
    (if (is-some profile)
      (get loyalty-level (unwrap-panic profile))
      u0
    )
  )
)

;; Public Functions
(define-public (set-max-discount (new-max uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (and (> new-max u0) (<= new-max u100)) ERR-INVALID-PARAM)
    (var-set max-discount new-max)
    (print { event: "config-update", param: "max-discount", value: new-max })
    (ok true)
  )
)

(define-public (set-complaint-threshold (new-threshold uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> new-threshold u0) ERR-INVALID-PARAM)
    (var-set complaint-threshold new-threshold)
    (print { event: "config-update", param: "complaint-threshold", value: new-threshold })
    (ok true)
  )
)

(define-public (set-decay-period (new-period uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> new-period u0) ERR-INVALID-PARAM)
    (var-set decay-period new-period)
    (print { event: "config-update", param: "decay-period", value: new-period })
    (ok true)
  )
)

(define-public (set-decay-factor (new-factor uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (and (>= new-factor u0) (<= new-factor u100)) ERR-INVALID-PARAM)
    (var-set decay-factor new-factor)
    (print { event: "config-update", param: "decay-factor", value: new-factor })
    (ok true)
  )
)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (var-set contract-owner new-owner)
    (print { event: "ownership-transfer", new-owner: new-owner })
    (ok true)
  )
)

(define-public (apply-discount-to-ticket (ticket-id uint))
  (let (
    (ticket (map-get? tickets ticket-id))
  )
    (asserts! (is-some ticket) ERR-INVALID-ID)
    (let (
      (unwrapped-ticket (unwrap-panic ticket))
      (profile-id (get profile-id unwrapped-ticket))
      (base-cost (get cost unwrapped-ticket))
      (discounted-cost (calculate-discount profile-id base-cost))
    )
      (asserts! (<= discounted-cost base-cost) ERR-DISCOUNT-APPLICATION-FAILED)
      (map-set tickets ticket-id
        (merge unwrapped-ticket { cost: discounted-cost })
      )
      (map-set discount-history { profile-id: profile-id, ticket-id: ticket-id }
        { applied-discount: (- base-cost discounted-cost), timestamp: block-height }
      )
      (print { event: "discount-applied", ticket-id: ticket-id, discount: (- base-cost discounted-cost) })
      (ok discounted-cost)
    )
  )
)

;; Read-Only Functions
(define-read-only (calculate-discount (profile-id uint) (base-cost uint))
  (let (
    (effective-complaints (calculate-effective-complaints profile-id))
    (level (get-loyalty-level profile-id))
    (max-d (var-get max-discount))
    (threshold (var-get complaint-threshold))
  )
    (if (> effective-complaints threshold)
      base-cost
      (let (
        (discount-perc (/ (* level max-d) u100))
        (tier-bonus (if (>= level u5) u5 (if (>= level u3) u3 u0))) ;; Tiered bonus
      )
        (- base-cost (* base-cost (/ (+ discount-perc tier-bonus) u100)))
      )
    )
  )
)

(define-read-only (get-config)
  {
    max-discount: (var-get max-discount),
    complaint-threshold: (var-get complaint-threshold),
    decay-period: (var-get decay-period),
    decay-factor: (var-get decay-factor),
    owner: (var-get contract-owner)
  }
)

(define-read-only (get-discount-history (profile-id uint) (ticket-id uint))
  (map-get? discount-history { profile-id: profile-id, ticket-id: ticket-id })
)

(define-read-only (get-effective-complaints (profile-id uint))
  (calculate-effective-complaints profile-id)
)

(define-read-only (simulate-discount (profile-id uint) (base-cost uint) (assumed-complaints uint) (assumed-unresolved uint) (assumed-level uint))
  (let (
    (effective (if (> assumed-complaints (var-get complaint-threshold)) assumed-complaints (+ assumed-complaints assumed-unresolved)))
  )
    (if (> effective (var-get complaint-threshold))
      base-cost
      (- base-cost (* base-cost (/ (* assumed-level (var-get max-discount)) u100)))
    )
  )
)

;; Additional Utility Functions for Robustness
(define-public (batch-apply-discounts (ticket-ids (list 10 uint)))
  (fold apply-discount-iter ticket-ids (ok u0))
)

(define-private (apply-discount-iter (ticket-id uint) (prev (response uint uint)))
  (match prev
    success (match (apply-discount-to-ticket ticket-id)
      discounted (ok (+ success discounted))
      error (err error)
    )
    error (err error)
  )
)

(define-read-only (estimate-batch-discount (profile-ids (list 10 uint)) (base-costs (list 10 uint)))
  (fold estimate-iter (zip profile-ids base-costs) (ok u0))
)

(define-private (estimate-iter (pair {profile: uint, cost: uint}) (prev (response uint uint)))
  (match prev
    success (ok (+ success (calculate-discount (get profile pair) (get cost pair))))
    error (err error)
  )
)

;; Mock setters for testing integration (in production, these would be called by other contracts)
(define-public (mock-set-profile (id uint) (level uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED) ;; For testing only
    (map-set profiles id { owner: tx-sender, join-date: block-height, loyalty-level: level })
    (ok true)
  )
)

(define-public (mock-set-complaints (id uint) (count uint) (unresolved uint) (last-time uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-set complaint-count id count)
    (map-set unresolved-count id unresolved)
    (map-set last-complaint-time id last-time)
    (ok true)
  )
)

(define-public (mock-set-ticket (id uint) (profile-id uint) (cost uint))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (map-set tickets id { owner: tx-sender, profile-id: profile-id, description: "Mock", status: "pending", cost: cost })
    (ok true)
  )
)