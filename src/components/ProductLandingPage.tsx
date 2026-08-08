import { ArrowRight, BookOpen, Camera, Check, Clock3, Github, Mail, Mic, Monitor, PlayCircle, QrCode, ShieldCheck, Users, Video } from "lucide-react";

const features = [
  { icon: Video, title: "Live educator camera", text: "Broadcast an educator camera feed with synchronized on/off controls for every student." },
  { icon: Mic, title: "Real-time host voice", text: "Deliver low-latency educator audio with browser-safe student playback controls." },
  { icon: Monitor, title: "Screen and whiteboard", text: "Teach with screen sharing, compatibility frames, annotations, and a collaborative digital canvas." },
  { icon: Users, title: "Interactive classroom", text: "Manage waiting rooms, attendance, chat, Q&A, polls, quizzes, reactions, and learning resources." },
  { icon: QrCode, title: "Simple secure joining", text: "Students enter with a four-digit code, QR link, email, name, and a randomized math check." },
  { icon: Clock3, title: "Free trial meetings", text: "Evaluate the full teaching experience through a server-enforced 30-minute educator trial." },
];

export default function ProductLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/about" className="relative h-12 w-48 overflow-hidden" aria-label="EZoom project overview">
            <img src="/ezoom-logo.png" alt="EZoom" className="absolute left-1/2 top-1/2 w-[290px] max-w-none -translate-x-1/2 -translate-y-1/2" />
          </a>
          <nav className="flex items-center gap-2">
            <a href="https://github.com/ejoetso/EZoom" target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 sm:flex">
              <Github className="h-4 w-4" /> GitHub
            </a>
            <a href="/app" className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">
              Open EZoom <ArrowRight className="h-4 w-4" />
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.2),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">Virtual classroom platform</span>
              <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">Teach, engage, and collaborate in one live room.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                EZoom is a self-hosted education and collaboration platform combining live camera and voice, screen broadcasting, whiteboards, classroom interaction, recording, and optional AI learning tools.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/app" className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400">
                  Try EZoom Free <PlayCircle className="h-5 w-5" />
                </a>
                <a href="https://github.com/ejoetso/EZoom" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold hover:bg-white/10">
                  View on GitHub <Github className="h-5 w-5" />
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400">
                {["Docker ready", "Public source", "30-minute trial", "LAN-aware QR links"].map((item) => (
                  <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {item}</span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 p-2 shadow-2xl shadow-cyan-950/50">
              <video controls preload="metadata" poster="/demo/05-live-classroom.png" className="aspect-video w-full rounded-[1.5rem] bg-black object-contain">
                <source src="/demo/EZoom-demo.mp4" type="video/mp4" />
              </video>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-400">
                <span>32-second product walkthrough</span>
                <a href="/demo/EZoom-demo.mp4" download className="font-bold text-cyan-300 hover:text-cyan-200">Download demo</a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-900/70 px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Complete teaching workspace</span>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Everything required to run an engaging online class</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 transition hover:-translate-y-1 hover:border-cyan-400/30">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-5 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/15 to-blue-600/10 p-8">
              <BookOpen className="h-8 w-8 text-cyan-300" />
              <h2 className="mt-5 text-2xl font-black">For educators</h2>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
                <li><strong className="text-white">1.</strong> Sign in, configure the classroom, and create a four-digit room code.</li>
                <li><strong className="text-white">2.</strong> Confirm camera, microphone, waiting room, and broadcast quality.</li>
                <li><strong className="text-white">3.</strong> Launch the session and teach using camera, voice, screen, whiteboard, chat, polls, and resources.</li>
              </ol>
            </article>
            <article className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-500/15 to-cyan-600/10 p-8">
              <ShieldCheck className="h-8 w-8 text-emerald-300" />
              <h2 className="mt-5 text-2xl font-black">For students</h2>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
                <li><strong className="text-white">1.</strong> Open EZoom or scan the educator’s LAN-aware QR link.</li>
                <li><strong className="text-white">2.</strong> Enter a name, email, session code, and the math security answer.</li>
                <li><strong className="text-white">3.</strong> Join the room to see the educator, hear live voice, collaborate, and respond to class activities.</li>
              </ol>
            </article>
          </div>
        </section>

        <section className="px-5 pb-24">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-cyan-500 p-8 text-slate-950 sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em]">Free product trial</span>
                <h2 className="mt-3 text-3xl font-black">Run a complete 30-minute EZoom meeting.</h2>
                <p className="mt-3 text-sm font-medium text-cyan-950">Trial educator: <span className="font-mono font-black">user@ejoecast.com</span> · Password: <span className="font-mono font-black">user123!</span></p>
              </div>
              <a href="/app" className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-bold text-white hover:bg-slate-900">Start the trial <ArrowRight className="h-5 w-5" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-10 text-sm text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>© 2026 Ejoe Tso. All rights reserved.</div>
          <div className="flex flex-wrap gap-4">
            <a href="https://github.com/ejoetso/EZoom" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white"><Github className="h-4 w-4" /> GitHub</a>
            <a href="mailto:eozoe2025@gmail.com" className="flex items-center gap-1.5 hover:text-white"><Mail className="h-4 w-4" /> Commercial, education, or collaboration</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
