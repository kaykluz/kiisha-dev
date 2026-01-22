import AppLayout from "@/components/AppLayout";
import { ViewList } from "@/components/ViewBuilder";

export default function CustomViews() {
  return (
    <AppLayout>
      <div className="p-6">
        <ViewList />
      </div>
    </AppLayout>
  );
}
