(define-constant ERR-NOT-AUTHORIZED u300)
(define-constant ERR-INVALID-PROFILE-ID u301)
(define-constant ERR-INVALID-COMPLAINT-ID u302)
(define-constant ERR-INVALID-DESCRIPTION u303)
(define-constant ERR-COMPLAINT-ALREADY-EXISTS u304)
(define-constant ERR-COMPLAINT-NOT-FOUND u305)
(define-constant ERR-COMPLAINT-ALREADY-RESOLVED u306)
(define-constant ERR-INVALID-TIMESTAMP u307)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u308)
(define-constant ERR-INVALID-RESOLVER u309)
(define-constant ERR-INVALID-UPDATE-PARAM u310)
(define-constant ERR-MAX-COMPLAINTS_EXCEEDED u311)
(define-constant ERR-INVALID-SEVERITY u312)
(define-constant ERR-INVALID-CATEGORY u313)
(define-constant ERR-INVALID-STATUS u314)
(define-constant ERR-INVALID-ATTACHMENT u315)
(define-constant ERR-INVALID-RESPONSE u316)
(define-constant ERR-INVALID-PRIORITY u317)
(define-constant ERR-INVALID-LOCATION u318)
(define-constant ERR-INVALID-EVIDENCE u319)
(define-constant ERR-INVALID-FEE u320)
(define-data-var contract-owner principal tx-sender)
(define-data-var next-complaint-global-id uint u0)
(define-data-var max-complaints-per-profile uint u100)
(define-data-var logging-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var resolver-fee uint u100)
(define-map complaints
  { profile-id: uint, complaint-id: uint }
  {
    timestamp: uint,
    description: (string-ascii 512),
    resolved: bool,
    severity: uint,
    category: (string-ascii 50),
    status: (string-ascii 20),
    attachment: (optional (buff 1024)),
    response: (optional (string-ascii 512)),
    priority: uint,
    location: (optional (string-ascii 100)),
    evidence: (optional (buff 2048))
  }
)
(define-map complaint-count uint uint)
(define-map resolvers principal bool)
(define-map complaint-updates
  { profile-id: uint, complaint-id: uint }
  {
    update-timestamp: uint,
    updater: principal,
    new-description: (string-ascii 512),
    new-severity: uint,
    new-priority: uint
  }
)
(define-map profile-complaint-ids uint (list 100 uint))
(define-read-only (get-complaint (profile-id uint) (complaint-id uint))
  (map-get? complaints { profile-id: profile-id, complaint-id: complaint-id })
)
(define-read-only (get-complaint-updates (profile-id uint) (complaint-id uint))
  (map-get? complaint-updates { profile-id: profile-id, complaint-id: complaint-id })
)
(define-read-only (get-complaint-count (profile-id uint))
  (default-to u0 (map-get? complaint-count profile-id))
)
(define-read-only (is-resolver (who principal))
  (default-to false (map-get? resolvers who))
)
(define-private (validate-profile-id (id uint))
  (if (> id u0)
    (ok true)
    (err ERR-INVALID-PROFILE-ID)
  )
)
(define-private (validate-complaint-id (id uint))
  (if (> id u0)
    (ok true)
    (err ERR-INVALID-COMPLAINT-ID)
  )
)
(define-private (validate-description (desc (string-ascii 512)))
  (if (and (> (len desc) u0) (<= (len desc) u512))
    (ok true)
    (err ERR-INVALID-DESCRIPTION)
  )
)
(define-private (validate-severity (sev uint))
  (if (and (>= sev u1) (<= sev u5))
    (ok true)
    (err ERR-INVALID-SEVERITY)
  )
)
(define-private (validate-category (cat (string-ascii 50)))
  (if (or (is-eq cat "service") (is-eq cat "product") (is-eq cat "billing") (is-eq cat "other"))
    (ok true)
    (err ERR-INVALID-CATEGORY)
  )
)
(define-private (validate-status (stat (string-ascii 20)))
  (if (or (is-eq stat "open") (is-eq stat "in-progress") (is-eq stat "closed"))
    (ok true)
    (err ERR-INVALID-STATUS)
  )
)
(define-private (validate-attachment (att (optional (buff 1024))))
  (match att value
    (if (<= (len value) u1024)
      (ok true)
      (err ERR-INVALID-ATTACHMENT)
    )
    (ok true)
  )
)
(define-private (validate-response (resp (optional (string-ascii 512))))
  (match resp value
    (if (<= (len value) u512)
      (ok true)
      (err ERR-INVALID-RESPONSE)
    )
    (ok true)
  )
)
(define-private (validate-priority (pri uint))
  (if (and (>= pri u1) (<= pri u3))
    (ok true)
    (err ERR-INVALID-PRIORITY)
  )
)
(define-private (validate-location (loc (optional (string-ascii 100))))
  (match loc value
    (if (<= (len value) u100)
      (ok true)
      (err ERR-INVALID_LOCATION)
    )
    (ok true)
  )
)
(define-private (validate-evidence (ev (optional (buff 2048))))
  (match ev value
    (if (<= (len value) u2048)
      (ok true)
      (err ERR-INVALID-EVIDENCE)
    )
    (ok true)
  )
)
(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP)
  )
)
(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)
(define-public (set-max-complaints-per-profile (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID_UPDATE-PARAM))
    (var-set max-complaints-per-profile new-max)
    (ok true)
  )
)
(define-public (set-logging-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID_FEE))
    (var-set logging-fee new-fee)
    (ok true)
  )
)
(define-public (add-resolver (who principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (map-set resolvers who true)
    (ok true)
  )
)
(define-public (remove-resolver (who principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (map-delete resolvers who)
    (ok true)
  )
)
(define-public (log-complaint
  (profile-id uint)
  (description (string-ascii 512))
  (severity uint)
  (category (string-ascii 50))
  (attachment (optional (buff 1024)))
  (priority uint)
  (location (optional (string-ascii 100)))
  (evidence (optional (buff 2048)))
)
  (let (
    (current-count (get-complaint-count profile-id))
    (new-complaint-id (+ current-count u1))
    (global-id (var-get next-complaint-global-id))
    (authority (var-get authority-contract))
  )
    (try! (validate-profile-id profile-id))
    (try! (validate-description description))
    (try! (validate-severity severity))
    (try! (validate-category category))
    (try! (validate-attachment attachment))
    (try! (validate-priority priority))
    (try! (validate-location location))
    (try! (validate-evidence evidence))
    (asserts! (< current-count (var-get max-complaints-per-profile)) (err ERR-MAX-COMPLAINTS_EXCEEDED))
    (asserts! (is-eq tx-sender (unwrap-panic (principal-of? (unwrap-panic (nft-get-owner? customer-profile profile-id))))) (err ERR-NOT-AUTHORIZED))
    (match authority auth
      (try! (stx-transfer? (var-get logging-fee) tx-sender auth))
      (err ERR-AUTHORITY-NOT-VERIFIED)
    )
    (map-set complaints { profile-id: profile-id, complaint-id: new-complaint-id }
      {
        timestamp: block-height,
        description: description,
        resolved: false,
        severity: severity,
        category: category,
        status: "open",
        attachment: attachment,
        response: none,
        priority: priority,
        location: location,
        evidence: evidence
      }
    )
    (map-set complaint-count profile-id new-complaint-id)
    (let ((current-ids (default-to (list) (map-get? profile-complaint-ids profile-id))))
      (map-set profile-complaint-ids profile-id (append current-ids new-complaint-id))
    )
    (var-set next-complaint-global-id (+ global-id u1))
    (print { event: "complaint-logged", profile-id: profile-id, complaint-id: new-complaint-id })
    (ok new-complaint-id)
  )
)
(define-public (resolve-complaint
  (profile-id uint)
  (complaint-id uint)
  (response (string-ascii 512))
)
  (let ((complaint (unwrap! (map-get? complaints { profile-id: profile-id, complaint-id: complaint-id }) (err ERR-COMPLAINT-NOT-FOUND))))
    (try! (validate-profile-id profile-id))
    (try! (validate-complaint-id complaint-id))
    (try! (validate-response (some response)))
    (asserts! (not (get resolved complaint)) (err ERR-COMPLAINT-ALREADY-RESOLVED))
    (asserts! (is-resolver tx-sender) (err ERR-INVALID-RESOLVER))
    (map-set complaints { profile-id: profile-id, complaint-id: complaint-id }
      {
        timestamp: (get timestamp complaint),
        description: (get description complaint),
        resolved: true,
        severity: (get severity complaint),
        category: (get category complaint),
        status: "closed",
        attachment: (get attachment complaint),
        response: (some response),
        priority: (get priority complaint),
        location: (get location complaint),
        evidence: (get evidence complaint)
      }
    )
    (print { event: "complaint-resolved", profile-id: profile-id, complaint-id: complaint-id })
    (ok true)
  )
)
(define-public (update-complaint
  (profile-id uint)
  (complaint-id uint)
  (new-description (string-ascii 512))
  (new-severity uint)
  (new-priority uint)
)
  (let ((complaint (unwrap! (map-get? complaints { profile-id: profile-id, complaint-id: complaint-id }) (err ERR_COMPLAINT-NOT_FOUND))))
    (try! (validate-profile-id profile-id))
    (try! (validate-complaint-id complaint-id))
    (try! (validate-description new-description))
    (try! (validate-severity new-severity))
    (try! (validate-priority new-priority))
    (asserts! (not (get resolved complaint)) (err ERR_COMPLAINT_ALREADY_RESOLVED))
    (asserts! (is-eq tx-sender (unwrap-panic (principal-of? (unwrap-panic (nft-get-owner? customer-profile profile-id))))) (err ERR-NOT-AUTHORIZED))
    (map-set complaints { profile-id: profile-id, complaint-id: complaint-id }
      {
        timestamp: block-height,
        description: new-description,
        resolved: (get resolved complaint),
        severity: new-severity,
        category: (get category complaint),
        status: (get status complaint),
        attachment: (get attachment complaint),
        response: (get response complaint),
        priority: new-priority,
        location: (get location complaint),
        evidence: (get evidence complaint)
      }
    )
    (map-set complaint-updates { profile-id: profile-id, complaint-id: complaint-id }
      {
        update-timestamp: block-height,
        updater: tx-sender,
        new-description: new-description,
        new-severity: new-severity,
        new-priority: new-priority
      }
    )
    (print { event: "complaint-updated", profile-id: profile-id, complaint-id: complaint-id })
    (ok true)
  )
)
(define-read-only (get-unresolved-count (profile-id uint))
  (let ((count (get-complaint-count profile-id)))
    (fold + (map (lambda (id) (if (not (get resolved (default-to { resolved: true } (map-get? complaints { profile-id: profile-id, complaint-id: id })))) u1 u0)) (unwrap-panic (as-max-len? (range u1 (+ count u1)) u100))) u0)
  )
)
(define-read-only (get-all-complaint-ids (profile-id uint))
  (default-to (list) (map-get? profile-complaint-ids profile-id))
)
(define-public (delete-complaint (profile-id uint) (complaint-id uint))
  (let ((complaint (unwrap! (map-get? complaints { profile-id: profile-id, complaint-id: complaint-id }) (err ERR_COMPLAINT-NOT_FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (map-delete complaints { profile-id: profile-id, complaint-id: complaint-id })
    (let ((current-count (get-complaint-count profile-id)))
      (map-set complaint-count profile-id (- current-count u1))
    )
    (let ((ids (default-to (list) (map-get? profile-complaint-ids profile-id))))
      (map-set profile-complaint-ids profile-id (filter (lambda (id) (not (is-eq id complaint-id))) ids))
    )
    (print { event: "complaint-deleted", profile-id: profile-id, complaint-id: complaint-id })
    (ok true)
  )
)
(define-public (set-resolver-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID_FEE))
    (var-set resolver-fee new-fee)
    (ok true)
  )
)
(define-read-only (get-global-complaint-count)
  (var-get next-complaint-global-id)
)
(define-read-only (get-logging-fee)
  (var-get logging-fee)
)
(define-read-only (get-resolver-fee)
  (var-get resolver-fee)
)
(define-read-only (get-max-complaints-per-profile)
  (var-get max-complaints-per-profile)
)