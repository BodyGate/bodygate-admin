# BodyGate

## Enterprise Fitness Operating System

BodyGate is a next-generation fitness management platform designed to unify:

- Gym CRM
- Smart Access Control
- Training Platform
- Athlete App
- Hardware Integration
- Realtime Monitoring

The project combines modern web technologies with real hardware access control systems to create a complete enterprise-grade fitness ecosystem.

---

# Main Features

## Smart Access Control

- Badge verification
- NFC support
- QR access ready
- Realtime access validation
- Turnstile integration
- Medical certificate validation
- Membership fee validation
- Subscription validation
- Customer block system
- Realtime presence monitoring
- Access logs

---

## Gym CRM

- Customer management
- Membership fees
- Subscription plans
- Customer notes
- Internal blocks
- Access history
- Realtime dashboard

---

## Training Platform

### Live Workout Engine
- Workout sessions
- Exercise tracking
- Set completion
- Reps / Weight tracking
- Progress %
- Workout summary

### Training Features
- Program builder
- Exercise library
- Rest timer
- PR Engine
- AI progression system
- Exercise media system
- Coach tips
- Machine setup notes
- Tutorial videos

### Athlete App
Routes:
- `/training`
- `/training/programs`
- `/training/workouts/[sessionId]`
- `/training/library`
- `/training/athlete`

---

# Technology Stack

## Frontend
- Next.js App Router
- React
- TypeScript
- Tailwind CSS

## Backend
- Next.js API Routes
- Supabase PostgreSQL
- Realtime subscriptions

## Hardware Integration
- TCP/IP access controllers
- Wiegand support
- BodyGate Access Bridge (.NET 8 C#)
- Turnstile integration

---

# Current Architecture

```text
Reader / Smart Terminal
↓
TCP/IP Controller
↓
BodyGate Access Bridge (.NET 8)
↓
BodyGate API
↓
Supabase Database
↓
Access Decision
↓
OpenDoor()
↓
Turnstile