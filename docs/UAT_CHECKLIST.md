# User Acceptance Testing (UAT) Checklist

This checklist provides a structured approach for Quality Assurance (QA) and product testers to validate the Staging deployment of the Event Booking System.

---

### CUSTOMER
- [ ] Register a new customer account
- [ ] Login successfully
- [ ] Logout successfully
- [ ] Browse events on the home/discovery page
- [ ] Search for events by keyword
- [ ] Filter events (if applicable)
- [ ] View Event details (image, date, price, available tickets)
- [ ] Create a Booking (select quantity, verify calculated price)
- [ ] Initiate Payment (using Cash or available Sandbox provider)
- [ ] Verify Payment is marked successfully on the backend
- [ ] Access "My Bookings" page and verify the booking appears
- [ ] Access the generated Ticket details
- [ ] Display the QR code for scanning
- [ ] Verify Notifications appear for booking success and payment success
- [ ] Request Cancellation/Refund (if within the allowed cutoff window)

### ORGANIZER
- [ ] Login with an Organizer account
- [ ] Access the Organizer Dashboard
- [ ] Create a new event (with title, description, price, capacity)
- [ ] Edit an existing event
- [ ] Access Event Bookings (attendee list) for an owned event
- [ ] Search/Filter attendees
- [ ] View Event Analytics (revenue, check-in counts)
- [ ] Access the Check-in Scanner view and successfully check-in a valid QR token

### SYSTEM (Infrastructure & Automations)
- [ ] Expiry: Create a pending booking, wait for the `BOOKING_EXPIRY_MINUTES` timeout, and verify the booking state changes to "Expired"
- [ ] Inventory restoration: Verify that the expired booking automatically releases tickets back into the event's available capacity exactly once
- [ ] Security: Attempt to check in a ticket using a customer account (Must fail with 403 Forbidden)
- [ ] Security: Attempt to view another organizer's analytics (Must fail with 403 Forbidden)
- [ ] Rate limiting: Trigger multiple rapid login failures and verify a `429 Too Many Requests` response
- [ ] Database: Ensure no random server 500 errors occur during workflows
- [ ] Scheduler: Confirm `bookings:expire` runs automatically without manual artisan commands
- [ ] Queue: Confirm background notifications are dispatched
- [ ] Storage: Ensure uploaded event images display correctly across the frontend

### PAYMENTS
- [ ] Payment architecture: Verify checkout enforces server-side price calculation
- [ ] Provider abstraction: Verify the codebase delegates logic to `PaymentService`
- [ ] Telebirr: External dependency documented (BLOCKED pending live credentials)
- [ ] CBE: External dependency documented (BLOCKED pending live credentials)
