"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getStudents,
  createStudent,
  getStudentRisk,
  getDashboard,
  type DashboardMetrics,
  type StudentRiskResponse,
} from "@/lib/api";

export type RiskLevel = "High" | "Medium" | "Low";

export type Signal = {
  name: string;
  value: number;
  change: number;
  trend: "up" | "down" | "stable";
};

export type InterventionStatus =
  | "Planned"
  | "In Progress"
  | "Completed"
  | "Needs Review";

export type Intervention = {
  id: number;
  studentId: number;
  studentName?: string;
  type: string;
  owner: string;
  date: string;
  status: InterventionStatus;
  notes: string;
  riskBefore: number;
  riskAfter?: number;
  outcome?: "Positive" | "No Change";
};

export type Student = {
  id: number;
  student_id: string;
  name: string;
  email: string | null;
  course: string;
  semester: string;
  initials: string;
  risk: RiskLevel;
  riskScore: number;
  signals: Signal[];
  flags: string[];
  intervention: string;
};

const initialInterventions: Intervention[] = [
  {
    id: 1,
    studentId: 1,
    studentName: "Aarav Sharma",
    type: "Mentor Meeting",
    owner: "Dr. Meera Gupta",
    date: "12 Sep 2026",
    status: "In Progress",
    notes: "Discuss attendance decline and identify barriers affecting engagement.",
    riskBefore: 70,
  },
  {
    id: 2,
    studentId: 2,
    studentName: "Diya Patel",
    type: "Academic Support",
    owner: "Academic Mentor",
    date: "13 Sep 2026",
    status: "Planned",
    notes: "Review recent assessments and create an academic improvement plan.",
    riskBefore: 50,
  },
];

const riskStyles = {
  High: {
    badge: "bg-[#fbe8ec] text-[#c95f70]",
    dot: "bg-[#d96b7b]",
  },
  Medium: {
    badge: "bg-[#faf1dc] text-[#a97820]",
    dot: "bg-[#d6a64f]",
  },
  Low: {
    badge: "bg-[#e5f4ed] text-[#478567]",
    dot: "bg-[#65a985]",
  },
};

const interventionStyles = {
  Planned: "bg-[#eee9fa] text-[#6f5bad]",
  "In Progress": "bg-[#edf5fa] text-[#527b9b]",
  Completed: "bg-[#e5f4ed] text-[#478567]",
  "Needs Review": "bg-[#fbe8ec] text-[#c95f70]",
};

// Demo Risk Model Heuristic
// Attendance = 40%, Academic performance = 30%, Submission timeliness = 20%, Engagement = 10%
function calculateRisk(
  attendance: number,
  academic: number,
  submission: number,
  engagement: number
) {
  const riskScore = Math.round(
    (100 - attendance) * 0.40 +
    (100 - academic) * 0.30 +
    (100 - submission) * 0.20 +
    (100 - engagement) * 0.10
  );

  const score = Math.max(0, Math.min(100, riskScore));

  let risk: RiskLevel;
  if (score >= 70) {
    risk = "High";
  } else if (score >= 40) {
    risk = "Medium";
  } else {
    risk = "Low";
  }

  return {
    score,
    risk,
  };
}

function createFlags(
  attendance: number,
  academic: number,
  submission: number,
  engagement: number
) {
  const flags: string[] = [];

  if (attendance < 75) {
    flags.push(`Attendance is at ${attendance}% (below recommended 75%)`);
  }
  if (academic < 70) {
    flags.push(`Academic score is at ${academic}% (requires attention)`);
  }
  if (submission < 70) {
    flags.push(`Assignment submission rate is at ${submission}% (missed deadlines)`);
  }
  if (engagement < 65) {
    flags.push(`Engagement activity is at ${engagement}% (below expected level)`);
  }
  if (flags.length === 0) {
    flags.push("Student demonstrates strong academic consistency and engagement");
  }

  return flags;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Home() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"All" | RiskLevel>("All");
  const [activeTab, setActiveTab] = useState<
    "Dashboard" | "Students" | "Attendance" | "Interventions" | "Fairness"
  >("Dashboard");

  const [interventions, setInterventions] = useState<Intervention[]>(initialInterventions);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);

  const [interventionStudent, setInterventionStudent] = useState<Student | null>(null);
  const [interventionType, setInterventionType] = useState("Mentor Meeting");
  const [interventionOwner, setInterventionOwner] = useState("Dr. Meera Gupta");
  const [interventionNotes, setInterventionNotes] = useState("");

  // Add Student Form State & Database Message
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentCourse, setNewStudentCourse] = useState("");
  const [newStudentSemester, setNewStudentSemester] = useState("6");
  const [newAttendance, setNewAttendance] = useState(85);
  const [newAcademic, setNewAcademic] = useState(80);
  const [newSubmission, setNewSubmission] = useState(80);
  const [newEngagement, setNewEngagement] = useState(80);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [databaseMessage, setDatabaseMessage] = useState<string | null>(null);
  const [backendStats, setBackendStats] = useState<DashboardMetrics | null>(null);

  // Fetch students from Flask Backend (or fallback to Supabase directly)
  const loadStudents = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      let rawData: any[] = [];
      let backendFailed = false;

      // 1. Try Flask Backend REST API first (PART 17)
      try {
        const apiStudents = await getStudents();
        if (Array.isArray(apiStudents) && apiStudents.length > 0) {
          rawData = apiStudents;
        } else {
          backendFailed = true;
        }
      } catch (backendError) {
        console.warn("Backend API getStudents note, using direct Supabase fallback:", backendError);
        backendFailed = true;
      }

      // 2. Fallback to direct Supabase client if backend didn't return rows
      if (backendFailed) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("students")
          .select("id, student_id, name, email, course, semester")
          .not("student_id", "ilike", "TEST_%")
          .order("id", { ascending: true });

        if (error) {
          console.error("Supabase students query error:", error);
          setDbError(error.message);
          setLoading(false);
          return;
        }
        rawData = data || [];
      }

      // Also try to load backend dashboard metrics
      try {
        const d = await getDashboard();
        if (d) setBackendStats(d);
      } catch (e) {
        console.warn("Dashboard API fetch note:", e);
      }

      if (rawData) {
        const mappedStudents: Student[] = rawData.map((dbStudent) => {
          let att = 80;
          let acad = 80;
          let sub = 80;
          let eng = 80;

          // Deterministic signals for monitored students
          if (dbStudent.student_id === "STU001") {
            att = 28;
            acad = 35;
            sub = 30;
            eng = 25;
          } else if (dbStudent.student_id === "STU002") {
            att = 65;
            acad = 60;
            sub = 55;
            eng = 50;
          } else if (dbStudent.student_id === "STU003") {
            att = 92;
            acad = 88;
            sub = 95;
            eng = 90;
          } else {
            // Check if custom signals were saved in localStorage
            try {
              if (typeof window !== "undefined") {
                const stored = localStorage.getItem(`student_signals_${dbStudent.student_id}`);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  if (parsed.attendance !== undefined) att = parsed.attendance;
                  if (parsed.academic !== undefined) acad = parsed.academic;
                  if (parsed.submission !== undefined) sub = parsed.submission;
                  if (parsed.engagement !== undefined) eng = parsed.engagement;
                } else {
                  att = 85;
                  acad = 82;
                  sub = 85;
                  eng = 80;
                }
              }
            } catch {
              att = 85;
              acad = 82;
              sub = 85;
              eng = 80;
            }
          }

          const riskCalc = calculateRisk(att, acad, sub, eng);
          const flags = createFlags(att, acad, sub, eng);
          const initials = getInitials(dbStudent.name);

          const semDisplay = dbStudent.semester
            ? typeof dbStudent.semester === "number"
              ? `${dbStudent.semester}th Semester`
              : String(dbStudent.semester).includes("Semester")
              ? dbStudent.semester
              : `${dbStudent.semester}th Semester`
            : "1st Semester";

          return {
            id: dbStudent.id,
            student_id: dbStudent.student_id,
            name: dbStudent.name,
            email: dbStudent.email,
            course: dbStudent.course || "B.Tech Computer Science",
            semester: semDisplay,
            initials,
            risk: riskCalc.risk,
            riskScore: riskCalc.score,
            signals: [
              {
                name: "Attendance",
                value: att,
                change: att < 50 ? -14 : att < 75 ? -5 : 4,
                trend: att < 50 ? "down" : att < 75 ? "down" : "up",
              },
              {
                name: "Academic Performance",
                value: acad,
                change: acad < 50 ? -8 : acad < 75 ? -3 : 5,
                trend: acad < 50 ? "down" : acad < 75 ? "down" : "up",
              },
              {
                name: "Submission Timeliness",
                value: sub,
                change: sub < 50 ? -18 : sub < 75 ? -2 : 2,
                trend: sub < 50 ? "down" : "up",
              },
              {
                name: "Engagement",
                value: eng,
                change: eng < 50 ? -25 : eng < 75 ? -4 : 6,
                trend: eng < 50 ? "down" : eng < 75 ? "down" : "up",
              },
            ],
            flags,
            intervention:
              riskCalc.risk === "High"
                ? "Schedule a mentor meeting and provide immediate academic support."
                : riskCalc.risk === "Medium"
                ? "Monitor progress and arrange a mentor check-in."
                : "Continue regular monitoring.",
          };
        });

        setStudents(mappedStudents);
      }
    } catch (err: any) {
      console.error("Failed to load students:", err);
      setDbError(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const stats = useMemo(
    () => ({
      total: backendStats ? backendStats.total_students : students.length,
      high: backendStats ? backendStats.high_risk : students.filter((student) => student.risk === "High").length,
      medium: backendStats ? backendStats.medium_risk : students.filter((student) => student.risk === "Medium").length,
      low: backendStats ? backendStats.low_risk : students.filter((student) => student.risk === "Low").length,
      avgAttendance: backendStats
        ? backendStats.average_attendance
        : students.length
        ? Math.round(
            students.reduce((acc, s) => {
              const att = s.signals.find((sig) => sig.name === "Attendance")?.value || 0;
              return acc + att;
            }, 0) / students.length
          )
        : 0,
      activeInterventions: backendStats
        ? backendStats.active_interventions
        : interventions.filter(
            (item) => item.status === "Planned" || item.status === "In Progress"
          ).length,
      completedInterventions: interventions.filter(
        (item) => item.status === "Completed"
      ).length,
    }),
    [students, interventions, backendStats]
  );

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.course.toLowerCase().includes(query) ||
        student.student_id.toLowerCase().includes(query);

      const matchesRisk =
        riskFilter === "All" || student.risk === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [students, search, riskFilter]);

  function openCreateIntervention(student: Student) {
    setInterventionStudent(student);
    setInterventionNotes(student.intervention);
    setShowCreateModal(true);
  }

  function createIntervention() {
    if (!interventionStudent) return;

    const newIntervention: Intervention = {
      id: Date.now(),
      studentId: interventionStudent.id,
      studentName: interventionStudent.name,
      type: interventionType,
      owner: interventionOwner,
      date: "14 Sep 2026",
      status: "Planned",
      notes:
        interventionNotes ||
        "Support plan created for the student.",
      riskBefore: interventionStudent.riskScore,
    };

    setInterventions((current) => [newIntervention, ...current]);
    setShowCreateModal(false);
    setInterventionStudent(null);
    setInterventionNotes("");
    setSelectedIntervention(newIntervention);
    setActiveTab("Interventions");
  }

  function updateInterventionStatus(status: InterventionStatus) {
    if (!selectedIntervention) return;

    const updatedRiskAfter =
      status === "Completed"
        ? Math.max(selectedIntervention.riskBefore - 21, 10)
        : undefined;

    setInterventions((current) =>
      current.map((item) =>
        item.id === selectedIntervention.id
          ? {
              ...item,
              status,
              ...(status === "Completed"
                ? {
                    riskAfter: updatedRiskAfter,
                    outcome: "Positive" as const,
                  }
                : {}),
            }
          : item
      )
    );

    setSelectedIntervention((current) =>
      current
        ? {
            ...current,
            status,
            ...(status === "Completed"
              ? {
                  riskAfter: updatedRiskAfter,
                  outcome: "Positive" as const,
                }
              : {}),
          }
        : current
    );
  }

  function resetAddStudentForm() {
    setNewStudentId("");
    setNewStudentName("");
    setNewStudentEmail("");
    setNewStudentCourse("");
    setNewStudentSemester("6");
    setNewAttendance(85);
    setNewAcademic(80);
    setNewSubmission(80);
    setNewEngagement(80);
    setDatabaseMessage(null);
    setIsSubmitting(false);
  }

  const addNewStudent = async () => {
    // 1. Form Validation
    if (!newStudentId.trim()) {
      setDatabaseMessage("Could not save student: Student ID cannot be empty.");
      return;
    }
    if (!newStudentName.trim()) {
      setDatabaseMessage("Could not save student: Name cannot be empty.");
      return;
    }
    if (!newStudentCourse.trim()) {
      setDatabaseMessage("Could not save student: Course cannot be empty.");
      return;
    }
    const parsedSemester = Number(newStudentSemester);
    if (!newStudentSemester || isNaN(parsedSemester) || parsedSemester <= 0) {
      setDatabaseMessage("Could not save student: Semester must be a valid number.");
      return;
    }

    setIsSubmitting(true);
    setDatabaseMessage(null);

    try {
      let createdStudentId = newStudentId.trim();
      let success = false;

      // 1. Try Flask Backend REST API first
      try {
        const res = await createStudent({
          student_id: newStudentId.trim(),
          name: newStudentName.trim(),
          email: newStudentEmail.trim() || null,
          course: newStudentCourse.trim(),
          semester: parsedSemester,
        });
        if (res && res.student) {
          createdStudentId = res.student.student_id;
          success = true;
        }
      } catch (backendErr: any) {
        console.warn("Backend add student note:", backendErr);
        if (
          backendErr.status === 409 ||
          (backendErr.message && backendErr.message.toLowerCase().includes("already exists"))
        ) {
          setDatabaseMessage(
            "Could not save student: Student ID already exists. Please choose a different Student ID."
          );
          setIsSubmitting(false);
          return;
        }
        // If not a conflict error (e.g. backend server is down), continue to Supabase fallback
      }

      // 2. Direct Supabase Fallback if Backend did not complete
      if (!success) {
        const supabase = createClient();

        const { data, error } = await supabase
          .from("students")
          .insert({
            student_id: newStudentId.trim(),
            name: newStudentName.trim(),
            email: newStudentEmail.trim() || null,
            course: newStudentCourse.trim(),
            semester: parsedSemester,
          })
          .select("id, student_id, name, email, course, semester")
          .single();

        if (error) {
          console.error("Add student error:", error);
          if (
            error.code === "23505" ||
            error.message.includes("unique constraint") ||
            error.message.includes("duplicate key")
          ) {
            setDatabaseMessage("Could not save student: Student ID already exists. Please choose a different Student ID.");
          } else {
            setDatabaseMessage(`Could not save student: ${error.message}`);
          }
          setIsSubmitting(false);
          return;
        }

        if (!data) {
          setDatabaseMessage("Could not save student: Student was not returned by Supabase.");
          setIsSubmitting(false);
          return;
        }
        createdStudentId = data.student_id;
      }

      // Save signals for this student
      try {
        if (typeof window !== "undefined") {
          const signalsData = {
            attendance: newAttendance,
            academic: newAcademic,
            submission: newSubmission,
            engagement: newEngagement,
          };
          localStorage.setItem(
            `student_signals_${createdStudentId}`,
            JSON.stringify(signalsData)
          );
        }
      } catch (e) {
        console.warn("Could not save signals to localStorage:", e);
      }

      // Reload students from Supabase as source of truth
      await loadStudents();

      // Close modal and clear form
      setShowAddStudentModal(false);
      resetAddStudentForm();
      setActiveTab("Students");
    } catch (err: any) {
      console.error("Add student error:", err);
      setDatabaseMessage(`Could not save student: ${err.message || "An unexpected error occurred"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf8fc] text-[#302a3a]">
      <header className="border-b border-[#e6dfeb] bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eee9fa] font-bold text-[#6f5bad]">
              EG
            </div>

            <div>
              <h1 className="font-serif text-2xl">
                EduGuard
              </h1>

              <p className="text-xs text-[#756d7d]">
                Student Success System · Supabase Live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">
                Dr. Meera Gupta
              </p>

              <p className="text-xs text-[#756d7d]">
                Mentor
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eee0f7] font-semibold text-[#765e9f]">
              MG
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-[#e6dfeb] bg-white">
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-6">
          {[
            "Dashboard",
            "Students",
            "Attendance",
            "Interventions",
            "Fairness",
          ].map((item) => (
            <button
              key={item}
              onClick={() =>
                setActiveTab(
                  item as
                    | "Dashboard"
                    | "Students"
                    | "Attendance"
                    | "Interventions"
                    | "Fairness"
                )
              }
              className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition ${
                activeTab === item
                  ? "border-b-2 border-[#8b78c9] text-[#6f5bad]"
                  : "text-[#756d7d] hover:text-[#6f5bad]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>

      {dbError && (
        <div className="mx-auto mt-4 max-w-[1500px] px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Database Notice:</strong> {dbError}
          </div>
        </div>
      )}

      <section className="mx-auto max-w-[1500px] px-6 py-8">
        {loading && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-[#eee9fa] p-4 text-sm text-[#6f5bad]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#6f5bad] border-t-transparent" />
            Loading live students from Supabase...
          </div>
        )}

        {activeTab === "Dashboard" && (
          <DashboardView
            stats={stats}
            students={students}
            onSelectStudent={setSelectedStudent}
            onCreateIntervention={openCreateIntervention}
            onViewInterventions={() => setActiveTab("Interventions")}
            onAddStudent={() => setShowAddStudentModal(true)}
          />
        )}

        {activeTab === "Students" && (
          <StudentsView
            students={filteredStudents}
            search={search}
            setSearch={setSearch}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            onSelectStudent={setSelectedStudent}
            onAddStudent={() => setShowAddStudentModal(true)}
          />
        )}

        {activeTab === "Attendance" && (
          <AttendanceView
            students={students}
            onReloadStudents={loadStudents}
          />
        )}

        {activeTab === "Interventions" && (
          <InterventionsView
            interventions={interventions}
            students={students}
            onSelect={setSelectedIntervention}
            onCreate={() => {
              setInterventionStudent(
                students.find((student) => student.risk === "High") ?? students[0] ?? null
              );
              setInterventionNotes("");
              setShowCreateModal(true);
            }}
          />
        )}

        {activeTab === "Fairness" && <FairnessView />}
      </section>

      {selectedStudent && (
        <StudentDetail
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onCreateIntervention={() => openCreateIntervention(selectedStudent)}
        />
      )}

      {showAddStudentModal && (
        <AddStudentModal
          studentId={newStudentId}
          setStudentId={setNewStudentId}
          name={newStudentName}
          setName={setNewStudentName}
          email={newStudentEmail}
          setEmail={setNewStudentEmail}
          course={newStudentCourse}
          setCourse={setNewStudentCourse}
          semester={newStudentSemester}
          setSemester={setNewStudentSemester}
          attendance={newAttendance}
          setAttendance={setNewAttendance}
          academic={newAcademic}
          setAcademic={setNewAcademic}
          submission={newSubmission}
          setSubmission={setNewSubmission}
          engagement={newEngagement}
          setEngagement={setNewEngagement}
          isSubmitting={isSubmitting}
          databaseMessage={databaseMessage}
          onClose={() => {
            setShowAddStudentModal(false);
            resetAddStudentForm();
          }}
          onAdd={addNewStudent}
        />
      )}

      {showCreateModal && interventionStudent && (
        <CreateInterventionModal
          student={interventionStudent}
          type={interventionType}
          setType={setInterventionType}
          owner={interventionOwner}
          setOwner={setInterventionOwner}
          notes={interventionNotes}
          setNotes={setInterventionNotes}
          onClose={() => setShowCreateModal(false)}
          onCreate={createIntervention}
        />
      )}

      {selectedIntervention && (
        <InterventionDetail
          intervention={selectedIntervention}
          student={students.find(
            (student) => student.id === selectedIntervention.studentId
          )}
          onClose={() => setSelectedIntervention(null)}
          onUpdateStatus={updateInterventionStatus}
        />
      )}
    </main>
  );
}

function DashboardView({
  stats,
  students,
  onSelectStudent,
  onCreateIntervention,
  onViewInterventions,
  onAddStudent,
}: {
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
    avgAttendance: number;
    activeInterventions: number;
    completedInterventions: number;
  };
  students: Student[];
  onSelectStudent: (student: Student) => void;
  onCreateIntervention: (student: Student) => void;
  onViewInterventions: () => void;
  onAddStudent: () => void;
}) {
  const highRiskStudents = students.filter(
    (student) => student.risk === "High"
  );

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#8b78c9]">
            Mentor Dashboard
          </p>

          <h2 className="font-serif text-4xl">
            Early support, not late intervention.
          </h2>

          <p className="mt-2 max-w-3xl text-[#756d7d]">
            EduGuard combines real-time Supabase data with an explainable Demo Risk Model to
            identify early dropout signals and guide timely interventions.
          </p>
        </div>

        <button
          onClick={onAddStudent}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#8b78c9] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6f5bad] hover:-translate-y-0.5"
        >
          <span className="text-lg font-bold">+</span>
          Add New Student
        </button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Total Students"
          value={stats.total}
          subtitle="Monitored in Supabase"
          icon="◌"
        />

        <SummaryCard
          title="High Risk"
          value={stats.high}
          subtitle="Needs immediate support"
          icon="!"
          tone="high"
        />

        <SummaryCard
          title="Medium Risk"
          value={stats.medium}
          subtitle="Needs monitoring"
          icon="~"
          tone="medium"
        />

        <SummaryCard
          title="Active Support"
          value={stats.activeInterventions}
          subtitle="Interventions underway"
          icon="→"
          tone="low"
        />

        <SummaryCard
          title="Avg Attendance"
          value={`${stats.avgAttendance}%`}
          subtitle="Class participation"
          icon="✓"
          tone="low"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <section className="rounded-2xl border border-[#e6dfeb] bg-white shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
          <div className="flex items-center justify-between border-b border-[#eee9f1] p-5">
            <div>
              <h3 className="font-serif text-2xl">
                Students Needing Attention
              </h3>

              <p className="mt-1 text-sm text-[#756d7d]">
                Students with the strongest current warning signals.
              </p>
            </div>

            <span className="rounded-full bg-[#fbe8ec] px-3 py-1 text-xs font-bold text-[#c95f70]">
              {highRiskStudents.length} High Risk
            </span>
          </div>

          <div className="divide-y divide-[#f0ebf3]">
            {highRiskStudents.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#756d7d]">
                No students currently in High Risk category.
              </div>
            ) : (
              highRiskStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-[#fcfaff] sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    onClick={() => onSelectStudent(student)}
                    className="flex items-center gap-3 text-left"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eee9fa] text-sm font-bold text-[#6f5bad]">
                      {student.initials}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {student.name}
                        </p>
                        <span className="rounded bg-[#eee9fa] px-1.5 py-0.5 text-[10px] font-bold text-[#6f5bad]">
                          {student.student_id}
                        </span>
                      </div>

                      <p className="text-xs text-[#756d7d]">
                        {student.course} · {student.semester}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    <RiskBadge risk={student.risk} />

                    <button
                      onClick={() => onCreateIntervention(student)}
                      className="rounded-lg bg-[#8b78c9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6f5bad]"
                    >
                      Support
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-[#e6dfeb] bg-white p-6 shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl">
                Risk Overview
              </h3>
              <span className="text-xs font-semibold text-[#8b78c9]">
                Demo Risk Model
              </span>
            </div>

            <p className="mt-1 text-sm text-[#756d7d]">
              Distribution of monitored Supabase students.
            </p>

            <div className="mt-6 space-y-5">
              <RiskBar
                label="High Risk (70-100)"
                count={stats.high}
                total={stats.total}
                color="bg-[#d96b7b]"
              />

              <RiskBar
                label="Medium Risk (40-69)"
                count={stats.medium}
                total={stats.total}
                color="bg-[#d6a64f]"
              />

              <RiskBar
                label="Low Risk (0-39)"
                count={stats.low}
                total={stats.total}
                color="bg-[#65a985]"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e8ddea] bg-[#faedf3] p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#c95f70]">
              Intervention Workflow
            </p>

            <div className="mt-4 space-y-3">
              {[
                "Detect changing risk patterns",
                "Understand explainable factors",
                "Create targeted support plan",
                "Track intervention progress",
                "Measure positive outcomes",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#8b78c9]">
                    {index + 1}
                  </span>

                  <span className="text-sm text-[#6f5360]">
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={onViewInterventions}
              className="mt-5 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#6f5bad] shadow-sm hover:bg-[#f8f3fb]"
            >
              Open Intervention Center
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

function StudentsView({
  students,
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  onSelectStudent,
  onAddStudent,
}: {
  students: Student[];
  search: string;
  setSearch: (value: string) => void;
  riskFilter: "All" | RiskLevel;
  setRiskFilter: (value: "All" | RiskLevel) => void;
  onSelectStudent: (student: Student) => void;
  onAddStudent: () => void;
}) {
  return (
    <>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#8b78c9]">
            Student Monitoring
          </p>

          <h2 className="font-serif text-4xl">
            Students
          </h2>

          <p className="mt-2 text-[#756d7d]">
            Connected directly to Supabase with real-time explainable risk scoring.
          </p>
        </div>

        <button
          onClick={onAddStudent}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#8b78c9] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6f5bad] hover:-translate-y-0.5"
        >
          <span className="text-lg font-bold">+</span>
          Add New Student
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e6dfeb] bg-white shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
        <div className="flex flex-col gap-4 border-b border-[#eee9f1] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-serif text-2xl">
              Student List ({students.length})
            </h3>

            <p className="mt-1 text-sm text-[#756d7d]">
              Live records from Supabase database
            </p>
          </div>

          <div className="flex gap-2">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by ID, name, or course..."
              className="w-full rounded-lg border border-[#e6dfeb] bg-[#fcfaff] px-3 py-2 text-sm outline-none focus:border-[#8b78c9] sm:w-64"
            />

            <select
              value={riskFilter}
              onChange={(event) =>
                setRiskFilter(
                  event.target.value as "All" | RiskLevel
                )
              }
              className="rounded-lg border border-[#e6dfeb] bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="All">All Risks</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#faf7fc] text-left text-xs uppercase tracking-wide text-[#756d7d]">
                <th className="px-5 py-4">Student</th>
                <th className="px-5 py-4">Risk Level</th>
                <th className="px-5 py-4">Risk Score</th>
                <th className="px-5 py-4">Attendance</th>
                <th className="px-5 py-4">Trend</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => {
                const attendance =
                  student.signals.find(
                    (signal) => signal.name === "Attendance"
                  );

                return (
                  <tr
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    className="cursor-pointer border-t border-[#f0ebf3] transition hover:bg-[#fcfaff]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eee9fa] text-xs font-bold text-[#6f5bad]">
                          {student.initials}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {student.name}
                            </p>
                            <span className="rounded bg-[#eee9fa] px-1.5 py-0.5 text-[10px] font-bold text-[#6f5bad]">
                              {student.student_id}
                            </span>
                          </div>

                          <p className="text-xs text-[#756d7d]">
                            {student.course} · {student.semester}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <RiskBadge risk={student.risk} />
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      {student.riskScore}%
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[#eeeaf1]">
                          <div
                            className="h-full rounded-full bg-[#8b78c9]"
                            style={{
                              width: `${attendance?.value ?? 0}%`,
                            }}
                          />
                        </div>

                        <span className="text-sm">
                          {attendance?.value}%
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          attendance?.trend === "down"
                            ? "font-medium text-[#d96b7b]"
                            : attendance?.trend === "up"
                            ? "font-medium text-[#65a985]"
                            : "text-[#756d7d]"
                        }
                      >
                        {attendance?.trend === "down"
                          ? "↓ Declining"
                          : attendance?.trend === "up"
                          ? "↑ Improving"
                          : "→ Stable"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStudent(student);
                        }}
                        className="rounded-lg bg-[#eee9fa] px-3 py-1.5 text-xs font-semibold text-[#6f5bad] hover:bg-[#8b78c9] hover:text-white"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {students.length === 0 && (
            <div className="p-10 text-center text-sm text-[#756d7d]">
              No students found in Supabase matching your search.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function AttendanceView({
  students,
  onReloadStudents,
}: {
  students: Student[];
  onReloadStudents: () => Promise<void>;
}) {
  const [date, setDate] = useState("2026-09-11");
  const [subject, setSubject] = useState("Computer Science");
  const [attendanceMap, setAttendanceMap] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const initialMap: Record<number, boolean> = {};
    students.forEach((s) => {
      initialMap[s.id] = s.risk !== "High";
    });
    setAttendanceMap(initialMap);
  }, [students]);

  function toggleAttendance(studentId: number) {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  }

  async function saveAttendance() {
    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const records = students.map((s) => ({
        student_id: s.id,
        date: date,
        subject: subject,
        present: attendanceMap[s.id] ?? false,
      }));

      const { error } = await supabase
        .from("attendance")
        .upsert(records, { onConflict: "student_id,date,subject" });

      if (error) {
        console.error("Attendance save error:", error);
        setMessage({ type: "error", text: "Attendance sync: " + error.message });
      } else {
        setMessage({
          type: "success",
          text: `Successfully recorded attendance for ${records.length} students on ${date} (${subject})!`,
        });
        await onReloadStudents();
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save attendance" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#8b78c9]">
            Attendance Recording
          </p>

          <h2 className="font-serif text-4xl">
            Take Attendance
          </h2>

          <p className="mt-2 text-[#756d7d]">
            Mark student presence to continuously update dropout risk calculations.
          </p>
        </div>

        <button
          onClick={saveAttendance}
          disabled={saving || students.length === 0}
          className="rounded-xl bg-[#8b78c9] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6f5bad] disabled:opacity-50"
        >
          {saving ? "Saving to Supabase..." : "Save Attendance"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 grid gap-4 rounded-2xl border border-[#e6dfeb] bg-white p-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#756d7d]">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-2.5 text-sm outline-none focus:border-[#8b78c9]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#756d7d]">
            Subject
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-2.5 text-sm outline-none focus:border-[#8b78c9]"
          >
            <option>Computer Science</option>
            <option>Mathematics</option>
            <option>Data Structures</option>
            <option>Operating Systems</option>
            <option>Database Management</option>
          </select>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e6dfeb] bg-white shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
        <div className="border-b border-[#eee9f1] p-5">
          <h3 className="font-serif text-2xl">
            Mark Students ({students.length})
          </h3>
          <p className="mt-1 text-sm text-[#756d7d]">
            Toggle Present or Absent for each registered student.
          </p>
        </div>

        <div className="divide-y divide-[#f0ebf3]">
          {students.map((student) => {
            const isPresent = attendanceMap[student.id] ?? true;

            return (
              <div
                key={student.id}
                className="flex items-center justify-between p-5 transition hover:bg-[#fcfaff]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eee9fa] text-xs font-bold text-[#6f5bad]">
                    {student.initials}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{student.name}</p>
                      <span className="rounded bg-[#eee9fa] px-1.5 py-0.5 text-[10px] font-bold text-[#6f5bad]">
                        {student.student_id}
                      </span>
                    </div>

                    <p className="text-xs text-[#756d7d]">
                      {student.course} · {student.semester}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleAttendance(student.id)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                      isPresent
                        ? "bg-[#e5f4ed] text-[#478567] hover:bg-[#d5eee0]"
                        : "bg-[#fbe8ec] text-[#c95f70] hover:bg-[#f8d7de]"
                    }`}
                  >
                    {isPresent ? "✓ Present" : "✕ Absent"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function InterventionsView({
  interventions,
  students,
  onSelect,
  onCreate,
}: {
  interventions: Intervention[];
  students: Student[];
  onSelect: (item: Intervention) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#8b78c9]">
            Support Management
          </p>

          <h2 className="font-serif text-4xl">
            Intervention Center
          </h2>

          <p className="mt-2 max-w-2xl text-[#756d7d]">
            Create, track and evaluate student support interventions.
          </p>
        </div>

        <button
          onClick={onCreate}
          className="rounded-xl bg-[#8b78c9] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6f5bad]"
        >
          + Create Intervention
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <WorkflowCard
          number="01"
          title="Identify"
          description="Review risk signals and understand why a student was flagged."
          tone="purple"
        />

        <WorkflowCard
          number="02"
          title="Support"
          description="Create targeted support with an assigned faculty owner."
          tone="pink"
        />

        <WorkflowCard
          number="03"
          title="Measure"
          description="Track completion and compare risk before and after support."
          tone="mint"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e6dfeb] bg-white shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
        <div className="border-b border-[#eee9f1] p-5">
          <h3 className="font-serif text-2xl">
            Active Interventions
          </h3>

          <p className="mt-1 text-sm text-[#756d7d]">
            Select an intervention to update its progress.
          </p>
        </div>

        <div className="divide-y divide-[#f0ebf3]">
          {interventions.map((item) => {
            const student = students.find((person) => person.id === item.studentId);
            const studentName = student?.name || item.studentName || "Student";
            const initials = student ? student.initials : getInitials(studentName);

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-[#fcfaff] lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eee9fa] text-xs font-bold text-[#6f5bad]">
                    {initials}
                  </div>

                  <div>
                    <p className="font-semibold">
                      {studentName}
                    </p>

                    <p className="mt-1 text-xs text-[#756d7d]">
                      {item.type} · {item.owner}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${interventionStyles[item.status]}`}
                  >
                    {item.status}
                  </span>

                  <span className="text-xs text-[#756d7d]">
                    {item.date}
                  </span>

                  <span className="text-sm font-semibold text-[#6f5bad]">
                    View →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function FairnessView() {
  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#8b78c9]">
          Responsible AI & Ethics
        </p>

        <h2 className="font-serif text-4xl">
          Fairness & Privacy Policy
        </h2>

        <p className="mt-2 max-w-2xl text-[#756d7d]">
          EduGuard is built strictly as a decision-support system to empower faculty with timely interventions, never for punitive or automated actions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-[#e6dfeb] bg-white p-6 shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f5ef] text-[#478567]">
            ✓
          </div>

          <h3 className="font-serif text-2xl">
            Fairness By Design
          </h3>

          <p className="mt-2 text-sm leading-6 text-[#756d7d]">
            The model strictly excludes protected demographic attributes (such as gender, race, religion, socio-economic status, or disability) from all risk scoring computations.
          </p>

          <div className="mt-5 space-y-3">
            <FairnessMetric
              label="Sensitive Attributes in Model"
              value="None (0%)"
            />

            <FairnessMetric
              label="Evaluation Criteria"
              value="Academic & Engagement Only"
            />

            <FairnessMetric
              label="Human-in-the-Loop Review"
              value="Mandatory"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[#e6dfeb] bg-white p-6 shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eee9fa] text-[#6f5bad]">
            🔒
          </div>

          <h3 className="font-serif text-2xl">
            Privacy & Transparency
          </h3>

          <p className="mt-2 text-sm leading-6 text-[#756d7d]">
            Student data remains strictly protected inside Supabase. Only authorized mentors and counselors have access to risk dashboards.
          </p>

          <div className="mt-5 rounded-xl bg-[#fcfaff] p-4 text-sm leading-6 text-[#756d7d]">
            Every prediction is explainable: mentors can directly examine which factor (Attendance, Academic Performance, Submission, or Engagement) contributed to the risk level.
          </div>
        </section>
      </div>
    </>
  );
}

function StudentDetail({
  student,
  onClose,
  onCreateIntervention,
}: {
  student: Student;
  onClose: () => void;
  onCreateIntervention: () => void;
}) {
  const [liveRisk, setLiveRisk] = useState<StudentRiskResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    getStudentRisk(student.student_id)
      .then((res) => {
        if (isMounted && res && res.risk_score !== undefined) {
          setLiveRisk(res);
        }
      })
      .catch((err) => {
        console.warn("Backend risk note for student detail:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [student.student_id]);

  const displayScore = liveRisk ? liveRisk.risk_score : student.riskScore;
  const displayRisk = liveRisk ? liveRisk.risk_level : student.risk;
  const displayFlags =
    liveRisk && liveRisk.flags && liveRisk.flags.length > 0
      ? liveRisk.flags
      : student.flags;
  const displayRecommendation = liveRisk
    ? liveRisk.recommendation
    : student.intervention;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#302a3a]/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#e6dfeb] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eee9fa] font-semibold text-[#6f5bad]">
                {student.initials}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-serif text-3xl">
                    {student.name}
                  </h2>

                  <span className="rounded bg-[#eee9fa] px-2 py-0.5 text-xs font-bold text-[#6f5bad]">
                    {student.student_id}
                  </span>

                  <RiskBadge risk={displayRisk} />

                  {liveRisk && (
                    <span className="rounded bg-[#e5f4ed] px-2 py-0.5 text-[10px] font-bold text-[#478567]">
                      ● Live Risk API
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-[#756d7d]">
                  {student.course} · {student.semester} {student.email ? `· ${student.email}` : ""}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f2f8] text-xl text-[#756d7d] hover:bg-[#eee9fa]"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h3 className="font-serif text-2xl">
              Explainable Risk Signals
            </h3>

            <p className="mt-1 text-sm text-[#756d7d]">
              Calculated weights: Attendance (40%), Academic (30%), Submissions (20%), Engagement (10%).
            </p>

            <div className="mt-5 space-y-4">
              {student.signals.map((signal) => {
                const signalVal =
                  liveRisk?.signals &&
                  (signal.name === "Attendance"
                    ? liveRisk.signals.attendance
                    : signal.name === "Academic Performance"
                    ? liveRisk.signals.academic
                    : signal.name === "Submission Timeliness"
                    ? liveRisk.signals.submission
                    : signal.name === "Engagement"
                    ? liveRisk.signals.engagement
                    : signal.value) !== undefined
                    ? (signal.name === "Attendance"
                        ? liveRisk.signals.attendance
                        : signal.name === "Academic Performance"
                        ? liveRisk.signals.academic
                        : signal.name === "Submission Timeliness"
                        ? liveRisk.signals.submission
                        : signal.name === "Engagement"
                        ? liveRisk.signals.engagement
                        : signal.value)
                    : signal.value;

                return (
                  <div
                    key={signal.name}
                    className="rounded-2xl border border-[#e6dfeb] p-4"
                  >
                    <div className="mb-3 flex justify-between">
                      <span className="text-sm font-semibold">
                        {signal.name}
                      </span>

                      <span className="font-semibold">
                        {signalVal}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#eeeaf1]">
                      <div
                        className="h-full rounded-full bg-[#8b78c9]"
                        style={{
                          width: `${signalVal}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-[#756d7d]">
                        Recent trajectory
                      </span>

                      <span
                        className={
                          signal.change < 0
                            ? "font-semibold text-[#d96b7b]"
                            : signal.change > 0
                            ? "font-semibold text-[#65a985]"
                            : "text-[#756d7d]"
                        }
                      >
                        {signal.change > 0 ? "+" : ""}
                        {signal.change}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="rounded-2xl bg-[#eee9fa] p-6">
              <p className="text-sm font-semibold text-[#6f5bad]">
                Overall Demo Risk Score
              </p>

              <div className="mt-3 flex items-end gap-2">
                <span className="font-serif text-6xl text-[#6f5bad]">
                  {displayScore}
                </span>

                <span className="mb-2 text-lg text-[#756d7d]">
                  / 100
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#8b78c9]"
                  style={{
                    width: `${displayScore}%`,
                  }}
                />
              </div>

              <p className="mt-4 text-sm leading-6 text-[#756d7d]">
                Higher score indicates greater risk of dropout. Multiple performance signals contribute to this heuristic.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="font-serif text-2xl">
                Why was this student flagged?
              </h3>

              <div className="mt-4 space-y-3">
                {displayFlags.map((flag) => (
                  <div
                    key={flag}
                    className="flex gap-3 rounded-xl bg-[#faedf3] p-3 text-sm leading-5 text-[#6f5360]"
                  >
                    <span className="text-[#c95f70]">•</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#dcece4] bg-[#e8f5ef] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#478567]">
                Recommended Action
              </p>

              <p className="mt-2 text-sm leading-6 text-[#426555]">
                {displayRecommendation}
              </p>

              <button
                onClick={onCreateIntervention}
                className="mt-4 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#478567] shadow-sm hover:bg-[#f5fbf8]"
              >
                Create Intervention Plan
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e6dfeb] bg-[#fcfaff] px-6 py-4 text-xs text-[#756d7d] sm:px-8">
          EduGuard is an assistive decision-support tool. Final intervention decisions remain with authorized faculty and mentors.
        </div>
      </div>
    </div>
  );
}

function AddStudentModal({
  studentId,
  setStudentId,
  name,
  setName,
  email,
  setEmail,
  course,
  setCourse,
  semester,
  setSemester,
  attendance,
  setAttendance,
  academic,
  setAcademic,
  submission,
  setSubmission,
  engagement,
  setEngagement,
  isSubmitting,
  databaseMessage,
  onClose,
  onAdd,
}: {
  studentId: string;
  setStudentId: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  course: string;
  setCourse: (value: string) => void;
  semester: string;
  setSemester: (value: string) => void;
  attendance: number;
  setAttendance: (value: number) => void;
  academic: number;
  setAcademic: (value: number) => void;
  submission: number;
  setSubmission: (value: number) => void;
  engagement: number;
  setEngagement: (value: number) => void;
  isSubmitting: boolean;
  databaseMessage: string | null;
  onClose: () => void;
  onAdd: () => void;
}) {
  const preview = calculateRisk(
    attendance,
    academic,
    submission,
    engagement
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#302a3a]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#e6dfeb] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#8b78c9]">
                Student Management
              </p>

              <h2 className="mt-1 font-serif text-3xl">
                Add New Student
              </h2>

              <p className="mt-1 text-sm text-[#756d7d]">
                Inserts directly into Supabase database with explainable demo signals.
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-2xl text-[#756d7d] hover:text-[#302a3a]"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {databaseMessage && (
          <div className="mx-6 mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium leading-relaxed text-red-700">
            <p className="font-semibold">{databaseMessage}</p>
            {databaseMessage.includes("row-level security") && (
              <div className="mt-3 border-t border-red-200 pt-2 text-[11px] text-red-600">
                <p className="font-bold">Required Supabase RLS Fix:</p>
                <p className="mt-1 font-sans text-gray-700">Run this SQL in your Supabase SQL Editor to allow public insert:</p>
                <code className="mt-1 block rounded border border-red-200 bg-white p-2 font-mono text-[10px] text-red-800 break-all">
                  create policy &quot;Allow public insert for testing&quot; on public.students for insert to anon with check (true);
                </code>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Student ID <span className="text-red-500">*</span>
              </label>
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="e.g. STU004"
                className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Student Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Sanket"
                className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="e.g. test@example.com"
                className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Course <span className="text-red-500">*</span>
              </label>
              <input
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                placeholder="e.g. BTECH CSE"
                className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Semester <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              placeholder="e.g. 6"
              className="w-full rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
            />
            <p className="mt-1 text-xs text-[#756d7d]">
              Enter the semester number (e.g. 6).
            </p>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="font-serif text-xl">
                Initial Performance Signals
              </h3>
              <p className="mt-1 text-xs text-[#756d7d]">
                Used to calculate the initial Demo Risk Score (Weights: 40% Attendance, 30% Academic, 20% Submissions, 10% Engagement).
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <SignalInput
                label="Initial Attendance"
                value={attendance}
                setValue={setAttendance}
              />

              <SignalInput
                label="Academic Performance"
                value={academic}
                setValue={setAcademic}
              />

              <SignalInput
                label="Submission Timeliness"
                value={submission}
                setValue={setSubmission}
              />

              <SignalInput
                label="Engagement Score"
                value={engagement}
                setValue={setEngagement}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#eee9fa] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6f5bad]">
                  Predicted Initial Risk
                </p>
                <p className="mt-1 text-sm text-[#756d7d]">
                  Calculated from the entered signals.
                </p>
              </div>

              <RiskBadge risk={preview.risk} />
            </div>

            <div className="mt-4 flex items-end gap-2">
              <span className="font-serif text-5xl text-[#6f5bad]">
                {preview.score}
              </span>
              <span className="mb-1 text-sm text-[#756d7d]">/ 100</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-[#8b78c9]"
                style={{
                  width: `${preview.score}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#e6dfeb] p-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#e6dfeb] px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={onAdd}
            disabled={
              isSubmitting ||
              !studentId.trim() ||
              !name.trim() ||
              !course.trim()
            }
            className="rounded-lg bg-[#8b78c9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6f5bad] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving to Supabase..." : "Save Student"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SignalInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-semibold">
          {label}
        </label>

        <span className="rounded-full bg-[#eee9fa] px-2.5 py-1 text-xs font-bold text-[#6f5bad]">
          {value}%
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) =>
          setValue(Number(event.target.value))
        }
        className="w-full accent-[#8b78c9]"
      />

      <div className="mt-1 flex justify-between text-[10px] text-[#9a929f]">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function CreateInterventionModal({
  student,
  type,
  setType,
  owner,
  setOwner,
  notes,
  setNotes,
  onClose,
  onCreate,
}: {
  student: Student;
  type: string;
  setType: (value: string) => void;
  owner: string;
  setOwner: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#302a3a]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#e6dfeb] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#8b78c9]">
                New Support Plan
              </p>

              <h2 className="mt-1 font-serif text-3xl">
                Create Intervention
              </h2>
            </div>

            <button
              onClick={onClose}
              className="text-2xl text-[#756d7d]"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-xl bg-[#eee9fa] p-4">
            <p className="text-xs text-[#756d7d]">
              Student
            </p>

            <p className="mt-1 font-semibold">
              {student.name} ({student.student_id})
            </p>

            <p className="mt-1 text-xs text-[#756d7d]">
              Current risk score: {student.riskScore}/100 ({student.risk} Risk)
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Intervention Type
            </label>

            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-xl border border-[#e6dfeb] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
            >
              <option>Mentor Meeting</option>
              <option>Attendance Counseling</option>
              <option>Academic Support</option>
              <option>Assignment Reminder</option>
              <option>Peer Mentoring</option>
              <option>Parent / Guardian Communication</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Assigned Owner
            </label>

            <select
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="w-full rounded-xl border border-[#e6dfeb] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
            >
              <option>Dr. Meera Gupta</option>
              <option>Academic Mentor</option>
              <option>Attendance Coordinator</option>
              <option>Student Counselor</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Support Notes
            </label>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Describe the action plan, meeting agenda, or follow-up goals..."
              className="w-full resize-none rounded-xl border border-[#e6dfeb] bg-[#fcfaff] px-4 py-3 text-sm outline-none focus:border-[#8b78c9]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#e6dfeb] p-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#e6dfeb] px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={onCreate}
            className="rounded-lg bg-[#8b78c9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6f5bad]"
          >
            Create Support Plan
          </button>
        </div>
      </div>
    </div>
  );
}

function InterventionDetail({
  intervention,
  student,
  onClose,
  onUpdateStatus,
}: {
  intervention: Intervention;
  student?: Student;
  onClose: () => void;
  onUpdateStatus: (status: InterventionStatus) => void;
}) {
  const riskImprovement =
    intervention.riskAfter !== undefined
      ? intervention.riskBefore - intervention.riskAfter
      : 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#302a3a]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#e6dfeb] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#8b78c9]">
                Intervention Tracking
              </p>

              <h2 className="mt-1 font-serif text-3xl">
                {intervention.type}
              </h2>

              <p className="mt-1 text-sm text-[#756d7d]">
                {student?.name || intervention.studentName || "Student"} · {intervention.owner}
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-2xl text-[#756d7d]"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="mb-2 text-sm font-semibold">
              Intervention Progress
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                "Planned",
                "In Progress",
                "Completed",
                "Needs Review",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() =>
                    onUpdateStatus(status as InterventionStatus)
                  }
                  className={`rounded-xl px-2 py-3 text-xs font-semibold transition ${
                    intervention.status === status
                      ? interventionStyles[status as InterventionStatus]
                      : "bg-[#f7f4f8] text-[#756d7d] hover:bg-[#eee9fa]"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#fcfaff] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#756d7d]">
              Support Notes
            </p>

            <p className="mt-2 text-sm leading-6">
              {intervention.notes}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <OutcomeCard
              label="Risk Before"
              value={`${intervention.riskBefore}%`}
            />

            <OutcomeCard
              label="Risk After"
              value={
                intervention.riskAfter !== undefined
                  ? `${intervention.riskAfter}%`
                  : "Pending"
              }
            />

            <OutcomeCard
              label="Change"
              value={
                intervention.riskAfter !== undefined
                  ? `-${riskImprovement}%`
                  : "Pending"
              }
            />
          </div>

          {intervention.status === "Completed" && (
            <div className="rounded-2xl border border-[#cfe7da] bg-[#e8f5ef] p-5">
              <p className="font-semibold text-[#478567]">
                Positive outcome recorded
              </p>

              <p className="mt-1 text-sm leading-6 text-[#426555]">
                The demo workflow confirms measurable reduction in dropout risk following intervention.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[#e6dfeb] bg-[#fcfaff] p-5">
          <p className="text-xs leading-5 text-[#756d7d]">
            Outcome tracking demonstrates how EduGuard evaluates the tangible impact of faculty support.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  tone?: "high" | "medium" | "low";
}) {
  const iconBackground = {
    high: "bg-[#fbe8ec] text-[#c95f70]",
    medium: "bg-[#faf1dc] text-[#a97820]",
    low: "bg-[#e5f4ed] text-[#478567]",
  };

  return (
    <div className="rounded-2xl border border-[#e6dfeb] bg-white p-5 shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#756d7d]">
            {title}
          </p>

          <p className="mt-4 font-serif text-4xl">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            tone
              ? iconBackground[tone]
              : "bg-[#eee9fa] text-[#6f5bad]"
          }`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-2 text-xs text-[#756d7d]">
        {subtitle}
      </p>
    </div>
  );
}

function RiskBadge({
  risk,
}: {
  risk: RiskLevel;
}) {
  const style = riskStyles[risk];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${style.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
      />
      {risk}
    </span>
  );
}

function RiskBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total
    ? Math.round((count / total) * 100)
    : 0;

  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-[#756d7d]">{count} ({percentage}%)</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#eeeaf1]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function FairnessMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#fcfaff] p-3 text-sm">
      <span className="text-[#756d7d]">{label}</span>
      <span className="font-semibold text-[#6f5bad]">{value}</span>
    </div>
  );
}

function WorkflowCard({
  number,
  title,
  description,
  tone,
}: {
  number: string;
  title: string;
  description: string;
  tone: "purple" | "pink" | "mint";
}) {
  const backgrounds = {
    purple: "bg-[#eee9fa] text-[#6f5bad]",
    pink: "bg-[#faedf3] text-[#c95f70]",
    mint: "bg-[#e8f5ef] text-[#478567]",
  };

  return (
    <div className="rounded-2xl border border-[#e6dfeb] bg-white p-5 shadow-[0_4px_20px_rgba(80,60,100,0.05)]">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-sm font-bold ${backgrounds[tone]}`}
      >
        {number}
      </div>

      <h4 className="mt-4 font-serif text-xl font-bold">
        {title}
      </h4>

      <p className="mt-2 text-xs leading-5 text-[#756d7d]">
        {description}
      </p>
    </div>
  );
}

function OutcomeCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#e6dfeb] bg-white p-4">
      <p className="text-xs text-[#756d7d]">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-[#6f5bad]">{value}</p>
    </div>
  );
}
