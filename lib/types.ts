export type Role = "admin" | "mentor" | "student";
export type ProfileStatus = "pending" | "active" | "rejected";
export type SubmissionStatus = "pending" | "graded";
export type AcademicBatch = "basic" | "intermediate" | "advanced";
export type Subject = "physics" | "math";

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: Role;
  status: ProfileStatus;
  total_points: number;
  badge_level: string;
  batch: AcademicBatch;
  subjects: Subject[];
  avatar_url: string | null;
  created_at: string;
};

export type Problem = {
  id: string;
  title: string;
  description: string;
  file_url: string | null;
  uploaded_by: string;
  subject: Subject;
  batch: AcademicBatch;
  deadline: string;
  max_points: number;
  created_at: string;
};

export type Submission = {
  id: string;
  problem_id: string;
  student_id: string;
  file_url: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  created_at: string;
};

export type Badge = {
  id: string;
  name: string;
  icon: string;
  points_threshold: number;
};
