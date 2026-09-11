/**
 * EduGuard API Client
 * Facilitates communication between Next.js Frontend and Flask Backend (:5000)
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface StudentPayload {
  student_id: string;
  name: string;
  email?: string | null;
  course: string;
  semester: number;
}

export interface StudentRiskResponse {
  student_id: string;
  student_name: string;
  signals: {
    attendance: number;
    academic: number;
    submission: number;
    engagement: number;
  };
  risk_score: number;
  risk_level: "High" | "Medium" | "Low";
  flags: string[];
  recommendation: string;
}

export interface DashboardMetrics {
  total_students: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  average_attendance: number;
  active_interventions: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type");
  const data = contentType && contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data as T;
}

// 1. Student Operations
export async function getStudents() {
  const data = await request<{ success: boolean; total: number; students: any[] }>("/api/students");
  return data.students || [];
}

export async function createStudent(student: StudentPayload) {
  return await request<{ success: boolean; student: any }>("/api/students", {
    method: "POST",
    body: JSON.stringify(student),
  });
}

export async function getStudentById(studentId: string) {
  return await request<{ success: boolean; student: any }>(`/api/students/${encodeURIComponent(studentId)}`);
}

export const getStudent = getStudentById;

export async function deleteStudent(studentId: string) {
  return await request<{ success: boolean; message: string }>(`/api/students/${encodeURIComponent(studentId)}`, {
    method: "DELETE",
  });
}

// 2. Risk Operations
export async function getStudentRisk(studentId: string): Promise<StudentRiskResponse> {
  return await request<StudentRiskResponse>(`/api/students/${encodeURIComponent(studentId)}/risk`);
}

export async function calculateStudentRisk(studentId: string) {
  return await request<{ success: boolean; record: any; risk_assessment: StudentRiskResponse }>(
    `/api/students/${encodeURIComponent(studentId)}/risk/calculate`,
    { method: "POST" }
  );
}

export async function calculateAllRisks() {
  return await request<{
    total: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
    students: StudentRiskResponse[];
  }>("/api/risk/calculate-all", { method: "POST" });
}

// 3. Dashboard Operations
export async function getDashboard(): Promise<DashboardMetrics> {
  return await request<DashboardMetrics>("/api/dashboard");
}

// 4. Attendance Operations
export async function getAttendance(studentId: string) {
  return await request<{ success: boolean; attendance: any[] }>(
    `/api/students/${encodeURIComponent(studentId)}/attendance`
  );
}

export async function addAttendance(
  studentId: string,
  data: { date: string; subject: string; present: boolean }
) {
  return await request<{ success: boolean; record: any }>(
    `/api/students/${encodeURIComponent(studentId)}/attendance`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function getAttendanceSummary(studentId: string) {
  return await request<{
    success: boolean;
    percentage: number;
    total_classes: number;
    present: number;
    absent: number;
  }>(`/api/students/${encodeURIComponent(studentId)}/attendance-summary`);
}

// 5. Academic Performance Operations
export async function getPerformance(studentId: string) {
  return await request<{
    success: boolean;
    average_score_percentage: number;
    assessments_count: number;
    records: any[];
  }>(`/api/students/${encodeURIComponent(studentId)}/performance`);
}

export async function addPerformance(
  studentId: string,
  data: {
    subject: string;
    assessment_name: string;
    score: number;
    max_score?: number;
    assessment_date: string;
  }
) {
  return await request<{ success: boolean; record: any }>(
    `/api/students/${encodeURIComponent(studentId)}/performance`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

// 6. Submissions Operations
export async function getSubmissions(studentId: string) {
  return await request<{
    success: boolean;
    submission_percentage: number;
    total_assignments: number;
    submitted_assignments: number;
  }>(`/api/students/${encodeURIComponent(studentId)}/submissions`);
}

export async function addSubmission(
  studentId: string,
  data: { assignment_id: number; status?: string }
) {
  return await request<{ success: boolean; record: any }>(
    `/api/students/${encodeURIComponent(studentId)}/submissions`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

// 7. Engagement Operations
export async function getEngagement(studentId: string) {
  return await request<{
    success: boolean;
    engagement_score: number;
    total_minutes: number;
    total_logins: number;
    sessions_recorded: number;
  }>(`/api/students/${encodeURIComponent(studentId)}/engagement`);
}

// 8. Research ML Models
export async function getModels() {
  return await request<{ models: string[]; default: string }>("/api/models");
}

export async function getModelMetrics(model?: string) {
  const query = model ? `?model=${encodeURIComponent(model)}` : "";
  return await request<any>(`/api/model-metrics${query}`);
}

export async function getFeatureImportance(model = "random_forest", topN = 10) {
  return await request<{ model: string; features: { feature: string; importance: number }[] }>(
    `/api/model-feature-importance?model=${encodeURIComponent(model)}&top_n=${topN}`
  );
}
