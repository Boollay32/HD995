#region HEADER
//  • GovtechHelpDesk
//   └ GovtechHelpDesk.Services
//    └ TicketManager.cs
// 
// Created 17/08/2017 11:14
// Updated 21/08/2017 17:34 by Sam (Sam)
#endregion

using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using Microsoft.Data.SqlClient;
using HelpDeskNet8.Utilities;
using System.Data;
using System.Net.Mail;


namespace HelpDeskNet8.Services
{
    public class MiscManager : IMiscManager
    {
        private readonly IDbConnection _connection;
        public MiscManager(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<DataTable> GetFilterItems(String Group)
        {

            DataTable FilterTable = new DataTable();
            var conn = (SqlConnection)_connection;
            try
            {
                using (SqlCommand command = conn.CreateCommand())
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandText = "[dbo].[usp_Helpdesk_GetFilter]";
                    command.Parameters.Add(new SqlParameter("@FilterGroup", SqlDbType.NVarChar) { Value = Group });

                    await conn.OpenAsync();

                    FilterTable.Load(await command.ExecuteReaderAsync());

                    await conn.CloseAsync();
                    return FilterTable;
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(MiscManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }

            return null;
        }

        public async Task<List<Object>> SendMailMessage(string from, string[] recepients, string subject, string body)
        {
            // Instantiate a new instance of MailMessage
            MailMessage mMailMessage = new MailMessage();

            // Set the sender address of the mail message
            mMailMessage.From = new MailAddress(from);

            foreach (string recepient in recepients)
            {
                // Set the recepient address of the mail message
                mMailMessage.To.Add(new MailAddress(recepient));
            }

            // Set the subject of the mail message
            mMailMessage.Subject = subject;
            // Set the body of the mail message
            mMailMessage.Body = body;

            // Set the format of the mail message body as HTML
            mMailMessage.IsBodyHtml = true;
            // Set the priority of the mail message to normal
            mMailMessage.Priority = MailPriority.Normal;

            // Instantiate a new instance of SmtpClient
            SmtpClient mSmtpClient = new SmtpClient();
            mSmtpClient.EnableSsl = true;
            mSmtpClient.Host = "smtp.office365.com";
            mSmtpClient.UseDefaultCredentials = false;
            mSmtpClient.Port = 587;
            //Attachment att = new Attachment(new MemoryStream(myBytes), name);

            mSmtpClient.Credentials = new System.Net.NetworkCredential(Environment.GetEnvironmentVariable("EmailSenderAddress"), Environment.GetEnvironmentVariable("EmailSenderPassword"), "govtech.co.uk");

            // Send the mail message
            List<Object> Result = new List<Object>();
            Exception Exeption = null;
            try
            {
                await mSmtpClient.SendMailAsync(mMailMessage);
                Result.Add("Success");
                Result.Add("Email Sent");

            }
            catch (Exception EX) { Exeption = EX; }
            {
                if (Exeption == null)
                {
                    return Result;
                }

                Result.Clear();
                Result.Add("Error");
                Result.Add(Exeption);
            }

            return Result;
        }

    }
}
