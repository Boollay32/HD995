using HelpDeskNet8.Interfaces.Shared;

namespace HelpDeskNet8.Interfaces.RFCs
{

    public interface IRFCManager
    {
        Task<IEnumerable<IRFCStub>> GetRFCs(int? CRUserID, IFilter IF);

        Task<IRFC> GetRFCDetail(int? RFCID);

        Task<List<Object>> SaveRFC(int CRUserID, IRFC RFC, int UTC);
    }
}