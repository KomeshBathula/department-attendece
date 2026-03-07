import React, { useState, useEffect } from 'react';
import { verifyPassword, getAttendance } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AdminLogin = ({ onBack }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // New states for Dashboard features
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [exportMessage, setExportMessage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableSemesters, setAvailableSemesters] = useState([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const [allStudents, setAllStudents] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      getAttendance().then(data => {
        const students = data.students || [];
        setAllStudents(students);

        const branches = new Set();
        const semesters = new Set();
        students.forEach(s => {
          if (s.branch) branches.add(s.branch.trim().toUpperCase());
          if (s.semester) semesters.add(s.semester.trim());
        });
        setAvailableBranches(Array.from(branches).sort());
        const sortedSems = Array.from(semesters).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        setAvailableSemesters(sortedSems);

        // Set initial filters to the first available values if any
        if (sortedSems.length > 0 && !selectedSemester) setSelectedSemester(sortedSems[0]);
        const sortedBranches = Array.from(branches).sort();
        if (sortedBranches.length > 0 && !selectedBranch) setSelectedBranch(sortedBranches[0]);

      }).catch(err => console.error("Error fetching filter data:", err));
    }
  }, [isAuthenticated]);

  // Recalculate stats whenever filters change
  useEffect(() => {
    if (allStudents.length > 0) {
      const filtered = allStudents.filter(s => {
        const sSem = (s.semester || '').trim().toLowerCase();
        const sBranch = (s.branch || '').trim().toLowerCase();
        const fSem = selectedSemester.toLowerCase();
        const fBranch = selectedBranch.toLowerCase();

        return (sSem === fSem || !fSem) && (sBranch === fBranch || !fBranch);
      });

      const total = filtered.length;
      const present = filtered.filter(s => s.isPresent).length;
      setStats({ total, present, absent: total - present });
    }
  }, [allStudents, selectedSemester, selectedBranch]);

  useEffect(() => {
    if (exportMessage) {
      const timer = setTimeout(() => {
        setExportMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [exportMessage]);

  // Remove auto-branch logic as it's now dynamic semester based

  const handleExportPDF = async () => {
    if (!selectedSemester || !selectedBranch) {
      setExportMessage('Please select both Semester and Branch to export.');
      return;
    }

    setIsExporting(true);
    setExportMessage(null);
    try {
      const data = await getAttendance();
      const students = data.students || [];

      // Case-insensitive filtering
      const filtered = students.filter(s => {
        const sSem = (s.semester || '').trim().toLowerCase();
        const sBranch = (s.branch || '').trim().toLowerCase();
        const fSem = selectedSemester.toLowerCase();
        const fBranch = selectedBranch.toLowerCase();

        let match = (sSem === fSem && sBranch === fBranch);

        if (!match) return false;

        if (selectedStatus === 'Present') {
          return s.isPresent === true;
        } else if (selectedStatus === 'Absent') {
          return s.isPresent === false;
        }

        return true; // "All" selected
      });

      // Sort natural alphanumeric by rollNo
      filtered.sort((a, b) => {
        const rollA = (a.rollNo || '').toString().toLowerCase();
        const rollB = (b.rollNo || '').toString().toLowerCase();
        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      });

      if (filtered.length === 0) {
        setExportMessage("No students registered for this filter");
        setIsExporting(false);
        return;
      }

      const doc = new jsPDF();
      doc.text(`Attendance Report - ${selectedSemester} - ${selectedBranch}`, 14, 15);

      const tableColumn = ["Roll No", "Name", "Branch", "Semester", "Status"];
      const tableRows = [];

      filtered.forEach(student => {
        const studentData = [
          student.rollNo || 'N/A',
          student.name || 'N/A',
          student.branch || 'N/A',
          student.semester || 'N/A',
          student.isPresent ? 'Present' : 'Absent'
        ];
        tableRows.push(studentData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
      });

      const statusSuffix = selectedStatus !== 'All' ? `_${selectedStatus}` : '';
      const fileName = `${selectedBranch}_${selectedSemester}${statusSuffix}_Attendance.pdf`;
      doc.save(fileName);

      setExportMessage(`Successfully exported ${filtered.length} students`);
    } catch (err) {
      setExportMessage("Error exporting data: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await verifyPassword(password);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-center p-4 relative">
        {/* Back button */}
        <button
          onClick={() => {
            console.log("Navigating back to home...");
            onBack();
          }}
          className="fixed top-4 left-4 sm:top-6 sm:left-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors cursor-pointer bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 z-[100] shadow-xl backdrop-blur-md"
        >
          <span className="text-xl">←</span> Home
        </button>

        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10"
        >
          Logout
        </button>

        <div className="flex flex-col items-center w-full max-w-4xl animate-fade-in-up">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mb-6 rounded-full overflow-hidden bg-slate-900/80 border-[3px] border-primary/40 p-1 shadow-[0_0_25px_rgba(139,92,246,0.3)] flex items-center justify-center transition-all hover:border-primary hover:shadow-[0_0_35px_rgba(139,92,246,0.5)] group backdrop-blur-xl scale-95 sm:scale-100">
            <img src="/logo.png" alt="Smart Attendance Logo" className="w-full h-full rounded-full object-cover drop-shadow-lg transition-transform group-hover:scale-110 duration-500" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-rose-500 mb-8 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]">
            HOD Dashboard
          </h1>

          <div className="glass-card p-8 rounded-3xl w-full shadow-2xl relative overflow-hidden flex flex-col items-center justify-start min-h-[400px]">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4 w-full mb-10 animate-fade-in-up stagger-1">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center group hover:bg-white/10 transition-all">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Total</span>
                <span className="text-3xl font-black text-white text-glow">{stats.total}</span>
              </div>
              <div className="bg-success/5 rounded-2xl p-4 border border-success/10 text-center group hover:bg-success/10 transition-all">
                <span className="text-xs font-bold text-success/60 uppercase tracking-widest block mb-1">Present</span>
                <span className="text-3xl font-black text-success text-glow">{stats.present}</span>
              </div>
              <div className="bg-danger/5 rounded-2xl p-4 border border-danger/10 text-center group hover:bg-danger/10 transition-all">
                <span className="text-xs font-bold text-danger/60 uppercase tracking-widest block mb-1">Absent</span>
                <span className="text-3xl font-black text-danger text-glow">{stats.absent}</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Portal Controls</h2>
            <p className="text-slate-400 mb-8 text-sm italic">Filter and export attendance records securely.</p>

            <div className="w-full max-w-md space-y-6">
              {/* Filters */}
              <div className="flex flex-col gap-4">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Select Semester</label>
                  <div className="relative">
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all appearance-none cursor-pointer pr-10"
                    >
                      <option value="" disabled>Choose Semester</option>
                      {availableSemesters.map(sem => (
                        <option key={sem} value={sem}>{sem}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Select Branch</label>
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all appearance-none cursor-pointer pr-10"
                    >
                      <option value="" disabled>Choose Branch</option>
                      {availableBranches.map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Select Status</label>
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all appearance-none cursor-pointer pr-10"
                    >
                      <option value="All">All Students</option>
                      <option value="Present">Present Only</option>
                      <option value="Absent">Absent Only</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Message */}
              {exportMessage && (
                <div
                  onClick={() => setExportMessage(null)}
                  className={`p-4 mt-4 rounded-xl text-sm font-medium border cursor-pointer animate-fade-in-up ${exportMessage.includes("No students") ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" : exportMessage.includes("Error") ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-green-500/10 border-green-500/20 text-green-400"} transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <span>{exportMessage}</span>
                    <svg className="w-4 h-4 opacity-70 hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`w-full py-4 mt-2 bg-gradient-to-r from-success to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl shadow-lg shadow-success/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isExporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Export PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-center p-4 relative">
      {/* Back button */}
      <button
        onClick={() => {
          console.log("Navigating back to home...");
          onBack();
        }}
        className="fixed top-4 left-4 sm:top-6 sm:left-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors cursor-pointer bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 z-[100] shadow-xl backdrop-blur-md"
      >
        <span className="text-xl">←</span> Home
      </button>

      {/* Main Content */}
      <div className="flex flex-col items-center w-full max-w-md animate-fade-in-up">
        <div className="w-32 h-32 sm:w-40 sm:h-40 mb-8 rounded-full overflow-hidden bg-slate-900/80 border-[4px] border-primary/50 p-1.5 shadow-[0_0_40px_rgba(139,92,246,0.4)] flex items-center justify-center transition-all hover:border-primary hover:shadow-[0_0_50px_rgba(139,92,246,0.6)] group backdrop-blur-3xl scale-100 glow-border">
          <img src="/logo.png" alt="Smart Attendance Logo" className="w-full h-full rounded-full object-cover drop-shadow-2xl transition-transform group-hover:scale-110 duration-500" />
        </div>

        {/* Heading container */}
        <div className="text-center mb-10 w-full px-4">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-rose-500 mb-4 drop-shadow-[0_0_15px_rgba(139,92,246,0.4)] px-2">
            Admin Portal Authentication
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse"></div>
            Security Access Required
          </div>
        </div>

        {/* Login Box */}
        <div className="glass-card p-10 rounded-3xl border border-white/10 shadow-3xl w-full relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500">
          {/* Decorative glow */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>

          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-400 text-xs italic">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 mt-4 bg-gradient-to-r from-primary to-accent hover:from-primary hover:to-accent text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
