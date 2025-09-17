import { DashboardView } from '../../components/Dashboard/DashboardView';

export default function DashboardPage() {
  return (
    <div className="h-full min-h-screen bg-white relative">
      {/* Clean subtle pattern like reference */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] bg-[length:32px_32px] opacity-40"></div>
      
      {/* Very subtle accent areas */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-green-50/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100/30 rounded-full blur-3xl"></div>
      
      <div className="relative z-10">
        <DashboardView />
      </div>
    </div>
  );
} 