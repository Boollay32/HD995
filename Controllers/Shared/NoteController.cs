using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Shared
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class NoteController(
        INoteManager notesM,
        INoteService noteService) : ControllerBase
    {
        private readonly INoteManager _notesManager = notesM;
        private readonly INoteService _noteService = noteService;

        [HttpPost]
        public async Task<IActionResult> GetNotes([FromBody] GetNotesRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var notes = await _noteService.GetNotes(user, request.TicketId);
            return Ok(notes);
        }

        [HttpPost]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> SaveNote([FromBody] SaveNoteRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var (ok, error, notes) = await _noteService.SaveNote(user, request);
            if (!ok) return BadRequest(error);
            return Ok(notes);
        }

        [HttpPost]
        public async Task<IActionResult> GetRFCNotes([FromBody] GetRFCNotesRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var result = await _notesManager.GetRFCNotes(user, request.RFCId);
            return Ok(result);
        }
    }
}
