# Dragon Gym Management System Architecture

## 1. Project Overview
**Title:** Next-Generation Smart Fitness Center Management System Using Artificial Intelligence and Real-Time Scheduling.
**Branding:** Dragon Gym (Dynamic Rebranding Enabled).
**Goal:** A high-end, warrior-themed AI platform to manage gym operations, session-based bookings, and machine utilization with real-time analytics.

## 2. System Architecture
The application is a high-fidelity frontend prototype using `localStorage` for dynamic state management (e.g., website name, current bookings).

### Core Components:
- **Unified Frontend:** HTML5, Vanilla CSS (Premium Dark Mode), Javascript.
- **Dynamic Rebranding:** Admin-controlled website name stored in `localStorage`.
- **Session-Based Booking:** Logic to filter machines by body part sessions (Chest, Back, Legs, etc.).
- **Capacity Engine:** Enforces max 15 members per time slot and max 3 members per machine.

## 3. Key Features

### Machine Management
- Supports 24+ specific gym machines categorized by workout sessions.
- Real-time occupancy tracking (simulated).
- Visual feedback (RED color) when machine/slot is full.

### Slot Booking System
- **Morning (5-9 AM)** & **Evening (3-9 PM)** slots.
- Multi-step flow: Date Selection -> Session Selection -> Machine Filtering -> Slot Selection.
- Booking Summary page for confirmation.

### Dashboards
- **Admin:** Monitor bookings, traffic density, and dynamic website configuration.
- **Member:** Today's Assigned Session view showing relevant machines only.
- **Trainer:** Client routine management.

### Profile Management
- Full profile editing (Name, Email, Weight, Height, Address).
- Role-based logout system.

## 4. Data Entities (Local State)

### Booking Object
- `date`, `session`, `machine`, `time`, `status`.

### Machine List (Session-Mapped)
- **Chest Day**: Chest Press, Pec Fly, Incline Press, Decline Press.
- **Back Day**: Lat Pulldown, Seated Cable Row, T-Bar Row, Assisted Pull-Up.
- **Leg Day**: Leg Press, Leg Extension, Seated Leg Curl, Lying Leg Curl, Calf Raises, etc.

## 5. Design System
- **Theme:** Dragon Warrior (Deep Space Black, Fire Red `#ff3e3e`, Dragon Gold `#ff9d00`).
- **Typography:** 'Outfit' (Google Fonts).
- **Styling:** Glassmorphism, aggressive gradients, and responsive card layouts.
