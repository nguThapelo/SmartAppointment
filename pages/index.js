import Link from 'next/link';

const HomePage = () => {
  return (
    <section className="app-card rounded-2xl p-8 sm:p-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">SmartAppointment</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Manage appointments, providers, payments, and client communication through a streamlined scheduling platform.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/Appointments" className="app-btn-primary">
          View Appointments
        </Link>
      </div>
    </section>
  );
};

export default HomePage;