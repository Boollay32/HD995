#region HEADER
//  • GovtechHelpDesk
//   └ GovtechHelpDesk.Services
//    └ DbServiceCollectionExtensions.cs
// 
// Created 16/08/2017 12:34
// Updated 21/08/2017 17:34 by Sam (Sam)
#endregion

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Data;

namespace HelpDeskNet8.Services
{

    public static class ServiceCollectionExtensions
    {

        public static IServiceCollection AddDBConnection(this IServiceCollection services, string connectionstring)
        {
            if (services == null)
            {
                throw new ArgumentNullException(nameof(services));
            }

            // Transient (not Scoped): each manager gets its OWN SqlConnection. A single
            // shared per-request connection is unsafe now the data layer is async -- any
            // concurrent use (e.g. Task.WhenAll across two managers) corrupts one SqlConnection
            // (MARS is off). Per-manager connections are pooled, so the cost is negligible.
            services.TryAdd(ServiceDescriptor.Transient<IDbConnection>(sp => new SqlConnection(connectionstring)));

            return services;
        }

    }

}