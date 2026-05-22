\# BodyGate Architecture



\## Overview



BodyGate is an enterprise fitness operating system composed of:



\- Gym CRM

\- Smart Access Control

\- Training Platform

\- Athlete App

\- Hardware Access Bridge

\- Realtime Dashboard System



\---



\# Core Stack



\## Frontend

\- Next.js App Router

\- React

\- TypeScript

\- Tailwind CSS



\## Backend

\- Next.js API Routes

\- Supabase PostgreSQL

\- Realtime subscriptions



\## Hardware Layer

\- TCP/IP Access Controller

\- BodyGate Access Bridge (.NET 8 C#)

\- Turnstile integration

\- Smart terminals / Wiegand devices



\---



\# Main Modules



\## Access Control

Features:

\- Badge validation

\- Access verification

\- Medical certificate validation

\- Membership fee validation

\- Subscription validation

\- Customer blocks

\- Access logs

\- Realtime presence



Main API:

\- /api/access/check



\---



\## CRM

Features:

\- Customers

\- Subscriptions

\- Membership fees

\- Internal notes

\- Blocks

\- Access history



\---



\## Training Platform

Features:

\- Workout programs

\- Workout sessions

\- Live workout engine

\- Set tracking

\- Rest timer

\- PR engine

\- AI progression

\- Exercise media system



Main routes:

\- /training

\- /training/programs

\- /training/workouts/\[sessionId]

\- /training/library

\- /training/athlete



\---



\## Dashboard

Features:

\- Realtime stats

\- Access monitoring

\- Presence tracking

\- Realtime activity feed

\- Access charts



\---



\## Settings Engine

Features:

\- Module management

\- Pricing settings

\- Permission settings

\- Security system



\---



\# Hardware Architecture



Current setup:



DNAKE / Reader

↓

TCP/IP Controller

↓

BodyGate Bridge (.NET 8)

↓

BodyGate API

↓

Supabase

↓

OpenDoor()



\---



\# Current Status



Current project stage:

\- Enterprise prototype

\- Realtime access system working

\- Training platform operational

\- Dashboard operational

\- Hardware bridge operational



\---



\# Future Goals



\- Multi-tenant SaaS

\- Mobile app

\- QR dynamic access

\- NFC virtual card

\- AI progression v2

\- Device manager

\- Cloud hardware integration

