import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Resumes from "@/pages/Resumes";
import ResumeDetailPage from "@/pages/ResumeDetailPage";
import ResumeComparisonPage from "@/pages/ResumeComparisonPage";
import JobMatchPage from "@/pages/JobMatchPage";
import Interviews from "@/pages/Interviews";
import InterviewSessionPage from "@/pages/InterviewSessionPage";
import { RealtimeInterviewRoom } from "@/pages/RealtimeInterviewRoom";
import { RealtimeInterviewResults } from "@/pages/RealtimeInterviewResults";
import Billing from "@/pages/Billing";
import Analytics from "@/pages/Analytics";
import PlaceholderPage from "@/pages/PlaceholderPage";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />

            <Route
              path="/resumes"
              element={
                <RequireAuth>
                  <Resumes />
                </RequireAuth>
              }
            />

            <Route
              path="/resumes/:id"
              element={
                <RequireAuth>
                  <ResumeDetailPage />
                </RequireAuth>
              }
            />

            <Route
              path="/resumes/compare"
              element={
                <RequireAuth>
                  <ResumeComparisonPage />
                </RequireAuth>
              }
            />

            <Route
              path="/job-match"
              element={
                <RequireAuth>
                  <JobMatchPage />
                </RequireAuth>
              }
            />

            <Route
              path="/interviews"
              element={
                <RequireAuth>
                  <Interviews />
                </RequireAuth>
              }
            />

            <Route
              path="/interviews/:id"
              element={
                <RequireAuth>
                  <InterviewSessionPage />
                </RequireAuth>
              }
            />

            <Route
              path="/interviews/live/:id"
              element={
                <RequireAuth>
                  <RealtimeInterviewRoom />
                </RequireAuth>
              }
            />

            <Route
              path="/interviews/results/:id"
              element={
                <RequireAuth>
                  <RealtimeInterviewResults />
                </RequireAuth>
              }
            />

            <Route
              path="/analytics"
              element={
                <RequireAuth>
                  <Analytics />
                </RequireAuth>
              }
            />

            <Route
              path="/billing"
              element={
                <RequireAuth>
                  <Billing />
                </RequireAuth>
              }
            />

            <Route path="*" element={<PlaceholderPage title="Page not found" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
