namespace HelpDeskNet8.Requests
{
    public class GetRFCsRequest : AuthenticatedRequest
    {
        public Dictionary<string, string> Filters { get; set; }
    }

    public class GetRFCDetailRequest : AuthenticatedRequest
    {
        public int RFCId { get; set; }
    }

    public class SaveRFCRequest : AuthenticatedRequest
    {
        public int RFCId { get; set; }
        public string ObjectInfo { get; set; }
        public string Attachment { get; set; }
        public int UTC { get; set; }
    }
}
