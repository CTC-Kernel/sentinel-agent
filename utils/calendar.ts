
export const generateICS = (events: {
    title: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
}[]) => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sentinel GRC//NONSGML v1.0//EN\n";

    events.forEach(event => {
        const formatDate = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        icsContent += "BEGIN:VEVENT\n";
        icsContent += `UID:${Date.now()}-${Math.random().toString(36).substr(2, 9)}@sentinel-grc.com\n`;
        icsContent += `DTSTAMP:${formatDate(new Date())}\n`;
        icsContent += `DTSTART:${formatDate(event.startDate)}\n`;
        if (event.endDate) {
            icsContent += `DTEND:${formatDate(event.endDate)}\n`;
        } else {
            // Default to 1 hour duration if no end date
            const endDate = new Date(event.startDate.getTime() + 60 * 60 * 1000);
            icsContent += `DTEND:${formatDate(endDate)}\n`;
        }
        icsContent += `SUMMARY:${event.title}\n`;
        if (event.description) icsContent += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
        if (event.location) icsContent += `LOCATION:${event.location}\n`;
        icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    return icsContent;
};

export const downloadICS = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
