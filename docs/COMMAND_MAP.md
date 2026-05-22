\# BODYGATE COMMAND MAP v0.1



\## ENTERPRISE COMMAND STRUCTURE



This document defines:

\- modules

\- pages

\- buttons

\- actions

\- permissions

\- APIs

\- audit behavior

\- notifications



for the BodyGate enterprise platform.



\---



\# DASHBOARD MODULE



\## Dashboard Home



\### Button: Open Turnstile

\- Action: opens turnstile

\- Permission: access.turnstile.open

\- API: /api/access/open

\- Audit Log: YES

\- Notification: NO



\### Button: Lock Turnstile

\- Action: locks access

\- Permission: access.turnstile.lock

\- API: /api/access/lock

\- Audit Log: YES



\### Button: Refresh Dashboard

\- Action: refresh realtime widgets

\- Permission: dashboard.view

\- API: realtime subscriptions

\- Audit Log: NO



\### Widget: Presence Monitor

\- Action: shows realtime customers inside gym

\- Permission: dashboard.presence.view



\### Widget: Live Activity Feed

\- Action: shows realtime events

\- Permission: dashboard.activity.view



\---



\# CUSTOMERS MODULE



\## Customers List



\### Button: New Customer

\- Action: create customer

\- Permission: customers.create

\- API: customers insert

\- Audit Log: YES



\### Button: Edit Customer

\- Action: edit customer data

\- Permission: customers.edit

\- API: customers update

\- Audit Log: YES



\### Button: Block Customer

\- Action: creates customer block

\- Permission: customers.block

\- API: customer\_blocks insert

\- Audit Log: YES

\- Notification: OPTIONAL



\### Button: Delete Customer

\- Action: delete customer

\- Permission: customers.delete

\- API: customers delete

\- Audit Log: YES



\---



\## Customer Detail



\### Button: Renew Membership Fee

\- Action: renew annual membership fee

\- Permission: membership.renew

\- API: customer\_membership\_fees insert

\- Audit Log: YES



\### Button: Renew Subscription

\- Action: create subscription renewal

\- Permission: subscriptions.renew

\- API: customer\_subscriptions insert

\- Audit Log: YES



\### Button: Add Note

\- Action: add internal note

\- Permission: customers.notes.create

\- API: customer\_internal\_notes insert

\- Audit Log: YES



\### Button: Upload Medical Certificate

\- Action: upload certificate

\- Permission: customers.medical.upload

\- API: storage upload + customers update

\- Audit Log: YES



\---



\# ACCESS CONTROL MODULE



\## Access Logs



\### Button: View Access Logs

\- Action: shows access history

\- Permission: access.logs.view



\### Button: Force Access

\- Action: bypass validation

\- Permission: access.override

\- API: /api/access/open

\- Audit Log: YES

\- Notification: YES



\---



\## Access Engine



\### Validation Rules

\- Customer active

\- Valid membership fee

\- Active subscription

\- Valid medical certificate

\- No active blocks



\### Result States

\- ACCESS\_GRANTED

\- ACCESS\_DENIED

\- ACCESS\_BLOCKED

\- MEDICAL\_EXPIRED

\- SUBSCRIPTION\_EXPIRED

\- MEMBERSHIP\_EXPIRED



\---



\# PAYMENTS MODULE



\## Payments



\### Button: Register Payment

\- Action: create payment

\- Permission: payments.create

\- API: payments insert

\- Audit Log: YES



\### Button: Refund Payment

\- Action: refund payment

\- Permission: payments.refund

\- API: payments update

\- Audit Log: YES

\- Notification: YES



\---



\# TRAINING MODULE



\## Training Programs



\### Button: Create Program

\- Action: create training program

\- Permission: training.programs.create

\- API: training\_programs insert

\- Audit Log: YES



\### Button: Edit Program

\- Action: edit training program

\- Permission: training.programs.edit

\- API: training\_programs update

\- Audit Log: YES



\### Button: Duplicate Program

\- Action: clone program

\- Permission: training.programs.clone

\- API: program duplication service

\- Audit Log: YES



\---



\## Workout Session



\### Button: Start Workout

\- Action: starts live workout

\- Permission: training.workout.start

\- API: workout\_sessions insert



\### Button: Complete Set

\- Action: marks set completed

\- Permission: training.workout.execute

\- API: workout\_set\_logs insert



\### Button: Finish Workout

\- Action: closes session

\- Permission: training.workout.finish

\- API: workout\_sessions update



\### Rest Timer

\- Action: automatic countdown after set

\- Permission: training.workout.execute



\### PR Engine

\- Action: detects PR automatically

\- Permission: training.pr.detect



\### AI Suggestion

\- Action: load recommendation

\- Permission: training.ai.use



\---



\# EXERCISE LIBRARY MODULE



\### Button: Add Exercise

\- Action: create exercise

\- Permission: exercises.create



\### Button: Upload Media

\- Action: upload image/video

\- Permission: exercises.media.upload



\### Button: Edit Machine Setup

\- Action: update machine setup

\- Permission: exercises.machine.edit



\---



\# NOTIFICATION MODULE



\### Button: Send Notification

\- Action: push notification

\- Permission: notifications.send



\### Button: Mark as Read

\- Action: mark notification read

\- Permission: notifications.read



\---



\# SETTINGS MODULE



\## Module Settings



\### Button: Enable Module

\- Action: activate module

\- Permission: settings.modules.edit



\### Button: Disable Module

\- Action: deactivate module

\- Permission: settings.modules.edit



\---



\## Pricing Settings



\### Button: Create Plan

\- Action: create pricing plan

\- Permission: settings.pricing.edit



\---



\## Permissions Settings



\### Button: Assign Role

\- Action: assign role

\- Permission: settings.permissions.edit



\---



\# STAFF \& SECURITY MODULE



\## Staff Accounts



\### Button: Create Staff

\- Action: create operator account

\- Permission: staff.create



\### Button: Disable Staff

\- Action: disable operator

\- Permission: staff.disable



\---



\## Audit Logs



\### Button: View Audit Logs

\- Action: view security logs

\- Permission: audit.view



\---



\# HARDWARE MODULE



\## Device Manager



\### Button: Add Device

\- Action: register hardware

\- Permission: hardware.devices.create



\### Button: Test Device

\- Action: send hardware ping

\- Permission: hardware.devices.test



\### Button: Reboot Device

\- Action: reboot hardware

\- Permission: hardware.devices.reboot

\- Audit Log: YES



\---



\# FUTURE MODULES



\## QR Dynamic Access

\- QR generation

\- QR validation

\- QR expiration

\- QR realtime access



\## NFC Virtual Card

\- mobile NFC pass

\- dynamic virtual badge



\## AI Engine v2

\- fatigue detection

\- recovery analysis

\- progression prediction



\## SaaS Multi-Tenant

\- organizations

\- branches

\- tenant isolation

\- billing engine

