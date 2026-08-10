using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Requests
{
    public class GetFilterItemsRequest : AuthenticatedRequest
    {
        public string Group { get; set; }
    }

    public class GetDropDownListRequest : AuthenticatedRequest
    {
        public int Filter { get; set; }
        public string Group { get; set; }
    }

}
