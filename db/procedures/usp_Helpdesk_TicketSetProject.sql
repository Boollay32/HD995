-- ============================================================================
-- usp_Helpdesk_TicketSetProject
-- Moves a change-request ticket into a project, or back out to the pool.
--   Assign:   @ProjectID = a live project id. Target date is left as-is
--             (blank for pool tickets); it is set later on the ticket itself.
--   Unassign: @ProjectID = NULL. Target date is CLEARED - pool CRs must not
--             carry a deadline until they are re-assigned.
-- Guard: only CR/project request types (4, 10, 11) may move. Any other
-- ticket id is a no-op (RowsAffected = 0) - the app treats 0 as NotFound.
--
-- BEFORE RUNNING: sanity-check the column names against dbo.tblTicket
-- (TicketID / RequestID / ProjectID / TargetDate assumed from existing procs).
-- ============================================================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Helpdesk_TicketSetProject]
    @TicketID  INT,
    @ProjectID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.tblTicket
    SET ProjectID  = @ProjectID,
        TargetDate = CASE WHEN @ProjectID IS NULL THEN NULL ELSE TargetDate END
    WHERE TicketID = @TicketID
      AND RequestID IN (4, 10, 11);

    SELECT @@ROWCOUNT AS RowsAffected;
END
