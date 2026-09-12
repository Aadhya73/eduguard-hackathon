# EduGuard — Early Student Dropout Warning System

> An explainable, data-driven early warning system designed to help educators identify students who may be at risk of dropping out and take supportive action at an early stage.

---

## 📌 Overview

EduGuard is an **Early Student Dropout Warning System** that analyzes multiple student performance and engagement indicators to identify students who may require additional academic or mentoring support.

The system focuses on four key indicators:

- 📊 Attendance
- 📚 Academic Performance
- 📝 Assignment Submission Behavior
- 👥 Student Engagement

These indicators are processed through an explainable risk-scoring system and classified into:

- 🟢 Low Risk
- 🟡 Medium Risk
- 🔴 High Risk

The resulting information is presented through an educator-focused dashboard where users can search and filter students, understand the factors contributing to risk, and take supportive interventions.

---

## 🎯 Problem Statement

Student dropout is often identified only after the student has already disengaged significantly.

EduGuard aims to shift the approach from:

**Reactive Support → Proactive Support**

Instead of waiting until a student drops out, the system identifies early warning signals and helps educators decide where intervention may be appropriate.

---

## 💡 Solution

EduGuard provides a centralized dashboard that allows educators or administrators to:

1. View overall student risk statistics.
2. Search and filter students.
3. Identify students requiring attention.
4. View individual student risk details.
5. Understand the factors contributing to the risk score.
6. Receive supportive recommendations.
7. Manage intervention-related actions.

### High-Level Workflow

```text
Student Data
     ↓
Supabase Database
     ↓
Flask REST API
     ↓
Risk Analysis
     ↓
Low / Medium / High Risk
     ↓
Warning Flags + Explanation
     ↓
Educator Dashboard
     ↓
Supportive Intervention
     ↓
Monitor Student Progress