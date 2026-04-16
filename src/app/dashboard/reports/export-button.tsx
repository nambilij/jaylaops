"use client";

export function ExportButton({
  csvData,
  month,
}: {
  csvData: string;
  month: string;
}) {
  function downloadCSV() {
    const data = JSON.parse(csvData);

    let csv = `JaylaOps Monthly Report — ${month}\n\n`;

    // Staff performance
    csv += "STAFF PERFORMANCE\n";
    csv += "Name,Assigned,Completed,Rejected,Avg Score\n";
    for (const row of data.staffRows) {
      csv += `${row.name},${row.assigned},${row.completed},${row.rejected},${row.avgScore}\n`;
    }

    csv += "\n";

    // Unit performance
    csv += "UNIT PERFORMANCE\n";
    csv += "Room,Tasks,Completed,Issues,Urgent Feedback,Avg Rating\n";
    for (const row of data.unitRows) {
      csv += `${row.name},${row.tasks},${row.completed},${row.issues},${row.urgentFeedback},${row.avgRating}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jaylaops-report-${month.replace(/\s/g, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={downloadCSV}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      Export CSV
    </button>
  );
}
