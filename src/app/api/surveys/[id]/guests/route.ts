import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

/**
 * GET /api/surveys/[id]/guests — List all guests for a survey (owner only)
 * POST /api/surveys/[id]/guests — Bulk create guests from a name list
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: guests, error } = await supabase
      .from('guests')
      .select('*')
      .eq('survey_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ guests });
  } catch (error) {
    console.error('List guests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify the user owns this survey
    const { data: survey } = await supabase
      .from('surveys')
      .select('id')
      .eq('id', id)
      .single();

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const { guests: guestList } = await req.json();

    if (!Array.isArray(guestList) || guestList.length === 0) {
      return NextResponse.json(
        { error: 'Provide a "guests" array with at least one entry' },
        { status: 400 }
      );
    }

    const rows = guestList.map((g: { name: string; email?: string; phone?: string }) => ({
      survey_id: id,
      name: g.name.trim(),
      email: g.email?.trim() || null,
      phone: g.phone?.trim() || null,
      token: nanoid(10),
      status: 'invited',
    }));

    const { data, error } = await supabase
      .from('guests')
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ guests: data });
  } catch (error) {
    console.error('Create guests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
