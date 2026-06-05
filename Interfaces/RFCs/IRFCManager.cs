using HelpDeskNet8.Interfaces.Shared;

namespace HelpDeskNet8.Interfaces.RFCs
{

    public interface IRFCManager
    {
        IEnumerable<IRFCStub> GetRFCs(int? CRUserID, IFilter IF);

        IRFC GetRFCDetail(int? RFCID);

        List<Object> SaveRFC(int CRUserID, IRFC RFC, int UTC);
    }
}