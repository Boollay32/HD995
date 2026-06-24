using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Projects;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Projects;
using HelpDeskNet8.Utilities;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class ProjectManager : IProjectManager
    {
        private readonly IDbConnection _connection;

        public ProjectManager(IDbConnection connection)
        {
            _connection = connection;
        }

        public IEnumerable<IProjectStub> GetProjects(IUser user, int? statusId)
        {
            var projects = new ProjectList();

            using IDbCommand command = _connection.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_GetProjects]";

            var parameters = new Dictionary<string, (SqlDbType Type, object Value)>
            {
                { "@StatusID", (SqlDbType.Int, statusId) }
            };
            AddParameters(command, parameters);

            _connection.Open();
            try
            {
                using IDataReader reader = command.ExecuteReader();
                while (reader.Read())
                    if (ProjectStub.FromReader(reader) is ProjectStub mapped)
                        projects.Add(mapped);
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(ProjectManager), ex);
            }
            finally
            {
                _connection.Close();
            }

            return projects;
        }

        public IProject GetProjectDetail(IUser user, int projectId)
        {
            Project project = null;

            using IDbCommand command = _connection.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_GetProjectDetail]";

            var parameters = new Dictionary<string, (SqlDbType Type, object Value)>
            {
                { "@ProjectID", (SqlDbType.Int, projectId) }
            };
            AddParameters(command, parameters);

            _connection.Open();
            try
            {
                using IDataReader reader = command.ExecuteReader();

                // Result set 1: the project header.
                if (reader.Read())
                    project = MapHeader(reader);

                // Result set 2: the project's tickets.
                if (project != null && reader.NextResult())
                    while (reader.Read())
                        if (ProjectTicketStub.FromReader(reader) is ProjectTicketStub t)
                            project.Tickets.Add(t);
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(ProjectManager), ex);
            }
            finally
            {
                _connection.Close();
            }

            return project;
        }

        private static Project MapHeader(IDataReader reader)
        {
            if (reader["ProjectID"] == DBNull.Value) return null;

            return new Project
            {
                ProjectID = (int)reader["ProjectID"],
                ProjectName = reader["ProjectName"] as string,
                ProjectTypeID = (int)reader["ProjectTypeID"],
                ProjectType = reader["ProjectType"] as string,
                StatusID = (int)reader["StatusID"],
                Status = reader["Status"] as string,
                Description = reader["Description"] as string,
                OwnerID = (int)reader["OwnerID"],
                OwnerName = reader["OwnerName"] as string,
                CreatedBy = (int)reader["CreatedBy"],
                CreatedByName = reader["CreatedByName"] as string,
                CreatedDate = reader["CreatedDate"] as DateTime?,
                LastUpdateDate = reader["LastUpdateDate"] as DateTime?,
                TargetDate = reader["TargetDate"] as DateTime?,
                CompletionDate = reader["CompletionDate"] as DateTime?,
                TicketCount = (int)reader["TicketCount"],
                OpenTicketCount = (int)reader["OpenTicketCount"]
            };
        }

        public SaveResult SaveProject(IUser user, SaveProjectModel project)
        {
            using IDbCommand command = _connection.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_SaveProject]";

            var parameters = new Dictionary<string, (SqlDbType Type, object Value)>
            {
                { "@ProjectID",     (SqlDbType.Int,      SqlValue.OrNull(project.ProjectID)) },
                { "@ProjectName",   (SqlDbType.VarChar,  project.ProjectName) },
                { "@ProjectTypeID", (SqlDbType.Int,      project.ProjectTypeID) },
                { "@StatusID",      (SqlDbType.Int,      project.StatusID) },
                { "@Description",   (SqlDbType.VarChar,  SqlValue.OrNull(project.Description)) },
                { "@OwnerID",       (SqlDbType.Int,      project.OwnerID) },
                { "@TargetDate",    (SqlDbType.DateTime, SqlValue.OrNull(project.TargetDate)) },
                { "@UserID",        (SqlDbType.Int,      user.UserID) }
            };
            AddParameters(command, parameters);

            _connection.Open();
            try
            {
                // The proc returns one row: (ProjectID, Error). ProjectID = -1
                // with an Error message means a rule (e.g. the completion gate)
                // blocked the save.
                using IDataReader reader = command.ExecuteReader();
                if (reader.Read())
                {
                    int projectId = reader["ProjectID"] is int id ? id : 0;
                    string error = reader["Error"] as string;

                    if (!string.IsNullOrEmpty(error) || projectId <= 0)
                        return SaveResult.Failed(error ?? "Could not save the project.");

                    bool isUpdate = project.ProjectID.HasValue && project.ProjectID != 0;
                    return isUpdate
                        ? SaveResult.Updated(projectId)
                        : SaveResult.Created(projectId);
                }
                return SaveResult.Failed("Could not save the project.");
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(ProjectManager), ex);
                return SaveResult.Failed("An error occurred saving the project.");
            }
            finally
            {
                _connection.Close();
            }
        }

        private static void AddParameters(IDbCommand command, Dictionary<string, (SqlDbType Type, object Value)> parameterList)
        {
            foreach (var param in parameterList)
            {
                command.Parameters.Add(new SqlParameter(param.Key, param.Value.Type)
                {
                    Value = param.Value.Value ?? DBNull.Value
                });
            }
        }
    }
}
