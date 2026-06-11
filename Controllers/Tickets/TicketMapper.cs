using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Models.Tickets;
using System.Reflection;

namespace HelpDeskNet8.Controllers.Tickets
{
    public static class TicketMapper
    {
        // Wire keys handled explicitly (alias or deliberately excluded), so the
        // generic reflection pass below must skip them.
        private static readonly HashSet<string> Handled = new(StringComparer.OrdinalIgnoreCase)
        {
            "assignedTechName",   // -> AssignedTechID (int), not the AssignedTech name string
            "requestType",        // -> RequestID (int), not the RequestType name string
            "Authority",          // contact-client authority id rides the request DTO instead
            "assignedClientID",   // contact-client user id rides the request DTO instead
        };

        public static ITicket? Map(string objectInfo)
        {
            if (string.IsNullOrEmpty(objectInfo)) return null;

            var fields = objectInfo
                .Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Split('`'))
                .Where(s => s.Length == 2 && !string.IsNullOrEmpty(s[0]))
                .ToDictionary(s => s[0], s => s[1], StringComparer.OrdinalIgnoreCase);

            var ticket = new Ticket();

            // Aliases: the wire key differs from the property it feeds.
            if (fields.TryGetValue("assignedTechName", out var tech) && int.TryParse(tech, out int techId))
                ticket.AssignedTechID = techId;
            if (fields.TryGetValue("requestType", out var req) && int.TryParse(req, out int requestId))
                ticket.RequestID = requestId;

            // Everything else maps by case-insensitive property name with
            // type-aware parsing. This is what lets the create form's custom
            // fields persist: their element ids (claimReference, nino,
            // ticketTypeID, claimDate, ...) are the camelCase forms of the
            // Ticket property names.
            foreach (var pair in fields)
            {
                if (Handled.Contains(pair.Key)) continue;

                PropertyInfo? prop = typeof(Ticket).GetProperty(
                    pair.Key,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                if (prop == null || !prop.CanWrite) continue;

                Type type = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;

                if (type == typeof(string))
                    prop.SetValue(ticket, pair.Value);
                else if (type == typeof(int) && int.TryParse(pair.Value, out int i))
                    prop.SetValue(ticket, i);
                else if (type == typeof(DateTime) && DateTime.TryParse(pair.Value, out DateTime d))
                    prop.SetValue(ticket, d);
                else if (type == typeof(bool) && bool.TryParse(pair.Value, out bool b))
                    prop.SetValue(ticket, b);
            }

            return ticket;
        }
    }
}
