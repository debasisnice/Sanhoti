/**
 * Generate Google Calendar URL for an event
 * @param eventName - Name of the event
 * @param startDate - Start date string (PST)
 * @param endDate - End date string (PST, optional)
 * @param location - Location string (optional)
 * @param description - Event description (optional)
 * @returns Google Calendar URL
 */
export function generateCalendarUrl(
  eventName: string,
  startDate: string,
  endDate?: string,
  location?: string,
  description?: string
): string {
  const start = convertPSTToLocal(startDate);
  const end = endDate ? convertPSTToLocal(endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours if no end date
  
  // Format dates for Google Calendar (YYYYMMDDTHHmmssZ in UTC)
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };
  
  const startFormatted = formatDate(start);
  const endFormatted = formatDate(end);
  
  const title = `Sanhoti-${eventName}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startFormatted}/${endFormatted}`,
    ...(location && { location }),
    ...(description && { details: description }),
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Converts a PST date string to the user's local timezone
 * 
 * @param dateString - Date string in PST (can be date-only like "2025-07-19" or ISO string)
 * @returns Date object in user's local timezone
 */
export function convertPSTToLocal(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }

  // Check if it's a date-only string (YYYY-MM-DD format)
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  
  if (dateOnlyPattern.test(dateString)) {
    // For date-only strings, assume they represent midnight PST
    // PST is UTC-8, PDT is UTC-7
    // We need to determine if it's PST or PDT based on the date
    // For simplicity, we'll check if DST is likely in effect (roughly March-November)
    const [_year, month] = dateString.split('-').map(Number);
    const isDST = month >= 3 && month <= 11; // Rough DST period (March to November)
    const offset = isDST ? '-07:00' : '-08:00'; // PDT or PST
    
    const pstDateString = `${dateString}T00:00:00${offset}`;
    return new Date(pstDateString);
  } else {
    // For ISO strings with timezone info, parse directly
    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
      return new Date(dateString);
    }
    
    // For ISO strings without timezone, assume PST/PDT
    // Try to detect if it has time component
    if (dateString.includes('T')) {
      // Has time component, append PST/PDT offset
      const datePart = dateString.split('T')[0];
      const [_year, month] = datePart.split('-').map(Number);
      const isDST = month >= 3 && month <= 11;
      const offset = isDST ? '-07:00' : '-08:00';
      return new Date(`${dateString}${offset}`);
    }
    
    // Fallback: parse as-is
    return new Date(dateString);
  }
}

/**
 * Converts a local date to PST timezone
 * 
 * When a user selects a date in a date input (YYYY-MM-DD), we interpret it as
 * "this calendar date in the user's local timezone" and convert it to the
 * equivalent calendar date in PST.
 * 
 * @param dateInput - Date input (can be a Date object, date string in YYYY-MM-DD format, or ISO string)
 * @returns Date string in PST timezone (YYYY-MM-DD format)
 */
export function convertLocalToPST(dateInput: Date | string): string {
  if (!dateInput) {
    return '';
  }

  // Handle date-only strings (YYYY-MM-DD format from date inputs)
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof dateInput === 'string' && dateOnlyPattern.test(dateInput)) {
    // User selected a date like "2025-07-19" in their local timezone
    // We need to find what date this is in PST
    // Create a date object at midnight in the user's local timezone
    const localMidnight = new Date(dateInput + 'T00:00:00');
    
    // Get the UTC time of this local midnight
    const utcTime = localMidnight.getTime();
    
    // Determine if DST is likely in effect for this date
    const [_year, month] = dateInput.split('-').map(Number);
    const isDST = month >= 3 && month <= 11; // Rough DST period
    const pstOffsetHours = isDST ? -7 : -8; // PDT is UTC-7, PST is UTC-8
    
    // Convert to PST time
    const pstTime = utcTime + (pstOffsetHours * 60 * 60 * 1000);
    
    // Create a date from the PST time
    const pstDate = new Date(pstTime);
    
    // Format as YYYY-MM-DD in PST
    const pstYear = pstDate.getUTCFullYear();
    const pstMonth = String(pstDate.getUTCMonth() + 1).padStart(2, '0');
    const pstDay = String(pstDate.getUTCDate()).padStart(2, '0');
    
    return `${pstYear}-${pstMonth}-${pstDay}`;
  }
  
  // Handle Date objects or ISO strings
  const localDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  if (isNaN(localDate.getTime())) {
    return '';
  }

  // Get the date components in local timezone
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const localDateString = `${year}-${month}-${day}`;
  
  // Use the same logic as above
  const localMidnight = new Date(localDateString + 'T00:00:00');
  const utcTime = localMidnight.getTime();
  
  const monthNum = parseInt(month);
  const isDST = monthNum >= 3 && monthNum <= 11;
  const pstOffsetHours = isDST ? -7 : -8;
  
  const pstTime = utcTime + (pstOffsetHours * 60 * 60 * 1000);
  const pstDate = new Date(pstTime);
  
  const pstYear = pstDate.getUTCFullYear();
  const pstMonth = String(pstDate.getUTCMonth() + 1).padStart(2, '0');
  const pstDay = String(pstDate.getUTCDate()).padStart(2, '0');
  
  return `${pstYear}-${pstMonth}-${pstDay}`;
}

