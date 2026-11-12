import { ContentCalendar } from "@/components/admin/content-calendar";
import { getCalendarData } from "@/lib/queries";

export default async function AdminContentCalendarPage() {
  const data = await getCalendarData();
  return <ContentCalendar data={data} />;
}

