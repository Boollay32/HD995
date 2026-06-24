using System;

namespace HelpDeskNet8.Infrastructure
{
    /// <summary>
    /// Helpers for producing ADO.NET parameter values.
    /// </summary>
    public static class SqlValue
    {
        /// <summary>
        /// Returns <see cref="DBNull.Value"/> when <paramref name="value"/> is
        /// null, otherwise the value unchanged. Null-only: this does NOT coerce
        /// 0, false, empty/whitespace strings, or DateTime.MinValue to NULL.
        /// (TicketManager.ToSqlValue keeps that sentinel behaviour where ticket
        /// fields require it.)
        /// </summary>
        public static object OrNull(object value) => value ?? DBNull.Value;
    }
}
