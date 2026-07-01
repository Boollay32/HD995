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
        // UTC is already inherited from AuthenticatedRequest -- do NOT
        // redeclare it here. A redeclared property of the same name
        // shadows the base one; JSON deserialization (which binds
        // against this concrete type) then only populates the
        // shadowing copy, leaving AuthenticateActionFilter reading the
        // base property permanently stuck at its default (0) -- which
        // silently broke the session check on every RFC save.
        public int RFCId { get; set; }
        public string ObjectInfo { get; set; }
        public string Attachment { get; set; }
    }
}
